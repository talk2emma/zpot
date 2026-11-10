# Local development setup (macOS)

## Quick start

```bash
cd zpot-mobile
./scripts/doctor.sh          # verifies the toolchain (reports real status)
./scripts/bootstrap.sh       # env files, npm install, pod install, Docker build, migrate, seed
./scripts/start-api.sh       # PostGIS, Redis, Mailpit, API, worker
./scripts/start-android.sh   # emulator + Metro + build + launch
./scripts/start-ios.sh       # simulator + Metro + build + launch
./scripts/run-tests.sh       # backend + mobile + API contract
```

Editing happens in Antigravity IDE (or any editor) on the `zpot-mobile` folder. Native builds and debugging happen in Android Studio (`mobile/android`) and Xcode (`mobile/ios/Zpot.xcworkspace`).

## Services

| What | URL |
|---|---|
| API | http://localhost:8000/api/v1/ |
| Swagger | http://localhost:8000/api/v1/docs/ |
| Django admin | http://localhost:8000/admin/ (seeded `admin@zpot.dev`; the password is printed once by the seed) |
| Mailpit (verification and reset emails) | http://localhost:8025 |
| Metro | http://localhost:8081 |

## Networking: how the app reaches the API

| Target | Default base URL | Why |
|---|---|---|
| Android emulator | `http://10.0.2.2:8000/api/v1` | `10.0.2.2` is the emulator's alias for the host Mac. `start-android.sh` also runs `adb reverse tcp:8000 tcp:8000`, so `localhost` works too. |
| iOS simulator | `http://localhost:8000/api/v1` | The simulator shares the Mac's network stack. |
| Physical device | Set `ZPOT_API_URL_ANDROID` / `ZPOT_API_URL_IOS` in `mobile/.env` to `http://<Mac LAN IP>:8000/api/v1`, add the IP to `DJANGO_ALLOWED_HOSTS`, then run `npm run env` | The device and Mac must be on the same Wi-Fi. Cleartext HTTP is allowed only in debug builds (Android `usesCleartextTraffic` debug placeholder; iOS `NSAllowsLocalNetworking`). |

After changing `mobile/.env`, run `cd mobile && npm run env` (it also runs automatically on `npm start` and `npm install`).

## Email flows in development

Registration and password reset send real emails to Mailpit. Open http://localhost:8025:

* **On the iOS simulator**, open Mailpit in Safari and tap the `zpot://…` link. It deep-links into the app.
* **On Android**, open `http://10.0.2.2:8025` in the emulator's browser, or run `adb shell am start -a android.intent.action.VIEW -d "zpot://verify-email?token=…"`.
* **Anywhere**, debug builds show a "Paste verification link or token (development)" field on the verify and reset screens.

## Dev users

Run `docker compose exec api python manage.py seed_zpot_lisbon --with-users`. It creates `driver@zpot.dev`, `scout@zpot.dev` and `admin@zpot.dev` with random passwords, printed once. Set `ZPOT_SEED_PASSWORD` in `api/.env` to use a known shared password instead. Nothing is stored in the repo.

## Troubleshooting

* **`postgis/postgis` "no matching manifest for arm64".** Compose uses `imresamu/postgis:17-3.5`, a multi-arch build of the same image.
* **Gradle wrapper download timeouts.** `networkTimeout` is raised to 120 s in `gradle-wrapper.properties`.
* **The first Android build downloads the NDK (~1 GB) and build-tools 37.** Expect a long first build.
* **The first `pod install` downloads React Native prebuilt binaries and the Mapbox Maps SDK (CocoaPods; no secret token needed).**
