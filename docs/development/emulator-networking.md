# Emulator and simulator networking

The app needs two local services: the **API** (`:8000`, Docker) and **Metro** (`:8081`, JavaScript bundle). Mailpit (`:8025`) is only used by developers and E2E tests.

| Runtime | API base URL | How it reaches the host |
|---|---|---|
| iOS Simulator | `http://localhost:8000/api/v1` | The simulator shares the Mac's network stack. |
| Android emulator (default) | `http://10.0.2.2:8000/api/v1` | `10.0.2.2` is the emulator's alias for the host loopback. |
| Android emulator (alternative) | `http://localhost:8000/api/v1` | `adb reverse tcp:8000 tcp:8000` forwards the emulator's localhost to the host. `scripts/start-android.sh` sets this up. |
| Physical device | `http://<your-LAN-IP>:8000/api/v1` | Set `API_BASE_URL` in `mobile/.env`, run `node scripts/gen-env.js`, and add the IP to `DJANGO_ALLOWED_HOSTS`. |

The platform default is in `mobile/src/constants/env.ts`. An explicit `API_BASE_URL` in `mobile/.env` overrides it for both platforms, so don't put `10.0.2.2` there if you also run iOS.

Metro: iOS loads `localhost:8081` directly. Android needs `adb reverse tcp:8081 tcp:8081` (done by `start-android.sh`) or Dev Menu › *Change bundle location*.

Cleartext HTTP is allowed only in debug builds: Android `usesCleartextTraffic` debug placeholder, and the iOS ATS `NSAllowsLocalNetworking` exception.

## Checks

```bash
curl -s localhost:8000/api/v1/health/          # from the Mac
adb shell curl -s 10.0.2.2:8000/api/v1/health/ # from the emulator (if curl is present in the image)
adb reverse --list                             # shows tcp:8000 and tcp:8081 when forwarded
```

The app's Profile screen shows the API version (or "unreachable"). In dev builds it also shows the base URL in use.

## Troubleshooting

* **"Unable to load script"** (Android): Metro isn't reachable. Run `adb reverse tcp:8081 tcp:8081` and reload (press R twice).
* **Network error banner everywhere**: the API isn't running (`docker compose ps`), or the base URL is wrong for this runtime (see the table).
* **Works on iOS, not on Android**: `localhost` is set in `.env` without `adb reverse`.
* **Emulator restarted**: `adb reverse` rules are lost on reboot. Re-run `scripts/start-android.sh`.

## "Cannot connect to Metro … URL: 10.0.2.2:8081 … Error: undefined" after backgrounding (Android 15+)

**Symptom.** In a debug build, Zpot goes to the background, for example on the Navigate hand-off to Google Maps or
Waze, or by pressing Home. When it comes back, a LogBox warning says "Cannot connect to Metro" with `Error: undefined`,
and "Fast Refresh disconnected" shows. Metro is still running. This isn't a crash, and release builds aren't affected.

**Root cause** (reproduced on 2026-11-10, Pixel_10_Pro emulator, API 37):

1. When the app leaves the foreground, `NetworkPolicyManager` marks its UID
   `blocked_state={blocked=APP_BACKGROUND, effective=APP_BACKGROUND}` (`adb shell dumpsys netpolicy | grep UID=<uid>`).
2. About 5–7 s later, `ConnectivityService` destroys the UID's live TCP sockets. logcat shows
   `InetDiagMessage: Destroyed live tcp sockets for uids={<uid>}`.
3. The Fast Refresh WebSocket fails with `Software caused connection abort`. The exception has no message, so Metro's
   `HMRClient` reports `Error: undefined`. React Native's `HMRClient` never reconnects ("Reload app to reconnect").
   The dev-support packager link does retry, but it can't reconnect while the app is still in the background.

In the foreground the warning never appears (a 60 s control run showed 0 warnings). Changing `10.0.2.2` to
`localhost` with `adb reverse` doesn't help either, because every socket of the UID is destroyed.

**Fix (local development).** `scripts/start-android.sh` calls `allow_dev_background_network` (`scripts/lib.sh`). That
puts `pt.zpot.app` on the power-save allowlist, which exempts it from the background network block:

```bash
adb shell cmd deviceidle whitelist +pt.zpot.app     # what the script does
adb shell cmd deviceidle whitelist -pt.zpot.app     # undo
```

Verified: after 60 s in the background, 0 sockets were destroyed and there was no warning. On return, the app still
had 3 established connections to `10.0.2.2:8081`. `adb shell cmd connectivity
set-background-networking-enabled-for-uid` does **not** work, because NetworkPolicyManager resets that bit on the next
process-state change.

**Not applied to E2E runs, on purpose.** `scripts/e2e-part2.sh` keeps production behaviour: real users' apps lose
network and sockets in the background. The app recovers through React Query's refetch-on-focus and the API client's
retry of idempotent GETs, and the E2E flows that background the app (navigation hand-off and return) pass that way.
The allowlist is a device setting that persists. It doesn't change the APK or any app code.
