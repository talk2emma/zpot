# Zpot — Park smarter. Spend less.

Zpot is a parking discovery and mobility intelligence app for Lisbon. It is free-parking-first and driver-first: legal free options come first, the rules are explained in plain words, and every answer shows its evidence and freshness.

> **Part 1 of 2** — architecture, prototype audit, backend foundation, authentication, parking discovery and the core mobile journey. Status: [`docs/PART_1_COMPLETION_REPORT.md`](docs/PART_1_COMPLETION_REPORT.md) · machine-readable: [`docs/implementation-status.json`](docs/implementation-status.json)

> ⚠️ All parking rules in this repository are **development fixtures** (sample data), not confirmed Lisbon regulations.

## Repository

```
Interactive prototype (play me)-html/   read-only HTML design prototype (source of visual truth)
mobile/    React Native 0.87 + TypeScript (android/, ios/, src/, __tests__/, e2e/)
api/       Django 5.2 + DRF + GeoDjango (apps/, config/, tests/)
infra/     docker init scripts
scripts/   doctor, bootstrap, start-api/android/ios, reset-local-db, run-tests, tools/
docs/      architecture, api (OpenAPI), database, development, migration (audit), testing, decisions
```

## Quick start (macOS)

```bash
./scripts/doctor.sh        # what's installed (real checks)
./scripts/bootstrap.sh     # env files, npm/pod install, Docker build, migrate, seed (+dev users)
./scripts/start-api.sh     # http://localhost:8000/api/v1/  ·  docs /api/v1/docs/  ·  mail http://localhost:8025
./scripts/start-android.sh # or open mobile/android in Android Studio
./scripts/start-ios.sh     # or open mobile/ios/Zpot.xcworkspace in Xcode
./scripts/run-tests.sh     # backend + mobile + live API contract
```

Guides: [local setup & networking](docs/development/local-setup.md) · [Android Studio](docs/development/android-studio.md) · [Xcode](docs/development/xcode.md) · [maps](docs/development/maps.md)

## Stack

| | |
|---|---|
| Mobile | React Native 0.87.1 (New Architecture, Hermes), TypeScript strict, React Navigation 7, TanStack Query 5, Zustand 5, React Hook Form + Zod 4, Axios, Keychain, i18next (EN / PT-PT), MapLibre Native 11.5 |
| API | Django 5.2 LTS, DRF 3.18, SimpleJWT (rotation and blacklist), django-filter, drf-spectacular, Celery 5.6 + Redis 7.4 |
| Data | PostgreSQL 17 + PostGIS 3.5 (`geography` points, GiST, trigram/unaccent search) |
| Local infra | Docker Compose: PostGIS, Redis, Mailpit, API, worker |

## Key product rules (enforced in code and tests)

* Free ≠ vacant. Vacant ≠ legal. No restriction record is **not** proof of permission. Unconfirmed means `unknown`.
* Rules are evaluated over the **whole planned stay** in Lisbon time, covering DST, windows that cross midnight, max stay, closures and future rules.
* Ranking is free-first and **commercially neutral**. Sponsorship never changes the order.
* Parking discovery never requires an account.

See [system design](docs/architecture/system-design.md), the [API reference](docs/api/endpoints.md), the [database schema](docs/database/schema.md) and the [ADRs](docs/decisions/README.md).
