# Zpot — Park smarter. Spend less.

Zpot is a parking discovery and mobility intelligence app for Lisbon. It puts free parking and the driver first: legal free options come first, the rules are explained in plain words, and every answer shows its evidence and how fresh it is.

* **Status:** [`docs/FINAL_IMPLEMENTATION_REPORT.md`](docs/FINAL_IMPLEMENTATION_REPORT.md). Machine-readable: [`docs/implementation-status.json`](docs/implementation-status.json).

> ⚠️ All parking rules in this repository are **development fixtures** (sample data), not confirmed Lisbon regulations.

## Repository layout

```
Interactive prototype (play me)-html/   read-only HTML design prototype (source of visual truth)
mobile/    React Native 0.87 + TypeScript (android/, ios/, src/, __tests__/, e2e/)
api/       Django 5.2 + DRF + GeoDjango (apps/, config/, tests/)
infra/     docker init scripts
scripts/   doctor, bootstrap, start-api/android/ios, reset-local-db, run-tests, e2e, tools/
docs/      architecture, api (OpenAPI), database, development, migration (audit), testing, decisions
```

## Run it locally (macOS)

The backend runs in Docker. The mobile app runs natively on an Android emulator or an iOS simulator.

### 1. Prerequisites

| Tool | Version / notes |
|---|---|
| macOS | Apple silicon or Intel |
| Node.js | **22.11+** (`brew install node`) |
| Docker Desktop | Running, with Compose v2 |
| Android | Android Studio with its bundled JDK (Gradle needs JDK 17–25), an Android SDK and at least one emulator (AVD) |
| iOS | Xcode with an iOS simulator runtime, plus CocoaPods (`brew install cocoapods`) |
| Mapbox | A **public** access token (`pk.…`) from your [Mapbox account](https://account.mapbox.com/access-tokens/). No secret download token is needed |

You only need the Android or the iOS toolchain if you build for that platform.

Check what's installed:

```bash
git clone https://github.com/talk2emma/zpot.git
cd zpot
./scripts/doctor.sh
```

### 2. Bootstrap (one time)

```bash
./scripts/bootstrap.sh
```

The bootstrap script does six things:

* Creates `.env`, `api/.env` and `mobile/.env` from their `.env.example` templates. Existing files are left untouched.
* Runs `npm install` in `mobile/`.
* Runs `pod install` for iOS.
* Builds and starts the Docker services.
* Runs the database migrations.
* Seeds the Lisbon fixture data and dev users. The dev users' passwords are printed **once**, so save them.

### 3. Add your Mapbox token

Edit `mobile/.env`:

```
ZPOT_MAPBOX_PUBLIC_TOKEN=pk.your-public-token
```

Then regenerate the build config:

```bash
cd mobile && npm run env && cd ..
```

Only `pk.*` tokens are accepted, because the token is compiled into the app. `sk.*` secrets are rejected. `mobile/.env` is gitignored, so never commit a token. Without a token the app still runs: the map shows "not configured" and Explore falls back to its list view. See [docs/development/maps.md](docs/development/maps.md).

### 4. Start the backend

```bash
./scripts/start-api.sh
```

| Service | URL |
|---|---|
| API | http://localhost:8000/api/v1/ |
| Swagger docs | http://localhost:8000/api/v1/docs/ |
| Django admin | http://localhost:8000/admin/ |
| Mailpit (verification and reset emails) | http://localhost:8025 |

### 5. Run the app

```bash
./scripts/start-android.sh   # boots the first AVD (or pass a name), starts Metro, builds, installs and launches
./scripts/start-ios.sh       # picks the first iPhone simulator (or pass a name), starts Metro, builds and launches
```

You can also open `mobile/android` in Android Studio or `mobile/ios/Zpot.xcworkspace` in Xcode, with Metro running (`cd mobile && npm start`).

Expect the first build to be slow:

* **Android** downloads the NDK (about 1 GB) and the build tools.
* **iOS** downloads the React Native prebuilt binaries and the Mapbox SDK.

### 6. Run the tests

```bash
./scripts/run-tests.sh                                 # backend + mobile + live API contract
docker compose exec api pytest -q                      # backend only
cd mobile && npx tsc --noEmit && npx jest              # mobile only
./scripts/e2e-part2.sh ios|android                     # Maestro E2E against the real local API
```

The `Makefile` wraps the same commands. Run `make api`, `make android`, `make ios`, `make test`, `make seed`, `make reset-db`, `make logs` or `make down`.

### How the app reaches the API

| Target | Default API URL |
|---|---|
| Android emulator | `http://10.0.2.2:8000/api/v1` (`start-android.sh` also runs `adb reverse`, so `localhost` works too) |
| iOS simulator | `http://localhost:8000/api/v1` |
| Physical device | Set `ZPOT_API_URL_ANDROID` / `ZPOT_API_URL_IOS` in `mobile/.env` to `http://<your Mac's LAN IP>:8000/api/v1`, add the IP to `DJANGO_ALLOWED_HOSTS` in `api/.env`, and run `npm run env` |

### Email and dev accounts

* **Email:** registration and password reset emails land in Mailpit (http://localhost:8025). On the iOS simulator, open the `zpot://…` link in Safari. On Android, open `http://10.0.2.2:8025` in the emulator's browser. Debug builds also have a "Paste verification link or token" field.
* **Dev accounts:** `driver@zpot.dev`, `scout@zpot.dev` and `admin@zpot.dev`. To recreate them, run `docker compose exec api python manage.py seed_zpot_lisbon --with-users`. Set `ZPOT_SEED_PASSWORD` in `api/.env` for a known shared password.

### Troubleshooting

* **"Cannot connect to Metro … Error: undefined" on Android after leaving the app.** Android cut the debug app's network in the background. `start-android.sh` exempts the app on your dev device. To do it by hand, run `adb shell cmd deviceidle whitelist +pt.zpot.app`. See [emulator networking](docs/development/emulator-networking.md).
* **Gradle reports "Unsupported class file major version".** Gradle is using a JDK that's too new. Use Android Studio's JDK: `export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`.
* **The map is blank or shows "not configured".** Check `ZPOT_MAPBOX_PUBLIC_TOKEN` in `mobile/.env`, run `npm run env`, then rebuild.
* **The API isn't reachable.** Check `docker compose ps`, then `docker compose logs api`, then `./scripts/doctor.sh`.
* **Reset the database.** Run `./scripts/reset-local-db.sh`.

More guides: [local setup & networking](docs/development/local-setup.md) · [Android Studio](docs/development/android-studio.md) · [Xcode](docs/development/xcode.md) · [maps](docs/development/maps.md)

## Stack

| | |
|---|---|
| Mobile | React Native 0.87.1 (New Architecture, Hermes), TypeScript strict, React Navigation 7, TanStack Query 5, Zustand 5, React Hook Form + Zod 4, Axios, Keychain, i18next (EN / PT-PT), Mapbox Maps SDK 11 via `@rnmapbox/maps` |
| API | Django 5.2 LTS, DRF 3.18, SimpleJWT (rotation and blacklist), django-filter, drf-spectacular, Celery 5.6 + Redis 7.4 |
| Data | PostgreSQL 17 + PostGIS 3.5 (`geography` points, GiST, trigram/unaccent search) |
| Local infra | Docker Compose: PostGIS, Redis, Mailpit, API, worker, beat |

## Key product rules (enforced in code and tests)

* Free ≠ vacant. Vacant ≠ legal. No restriction record is **not** proof of permission. Unconfirmed means `unknown`.
* Rules are evaluated over the **whole planned stay** in Lisbon time, covering DST, windows that cross midnight, max stay, closures and future rules.
* Ranking is free-first and **commercially neutral**. Sponsorship never changes the order.
* Parking discovery never requires an account.

See [system design](docs/architecture/system-design.md), the [API reference](docs/api/endpoints.md), the [database schema](docs/database/schema.md) and the [ADRs](docs/decisions/README.md). Coding agents: see [AGENTS.md](AGENTS.md).
