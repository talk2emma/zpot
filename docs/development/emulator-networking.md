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
