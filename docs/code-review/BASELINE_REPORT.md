# Baseline report (before remediation)

* **Branch:** `code-review/2026-11` from `f9337ea`, captured 2026-11-09/10.
* **Machine:** Apple Silicon Mac, with Docker Desktop running the API, PostGIS, Redis, a Celery worker and beat, and Mailpit.
* **Devices:** iPhone 18 Pro simulator (iOS 27.0). The Android emulator is Pixel_10_Pro (API 37).

## Tool versions

| Tool | Version |
|---|---|
| Python / Django / DRF / Celery | 3.13.18 / 5.2.19 / 3.18.3 / 5.6.3 |
| Ruff | 0.17.2 |
| PostgreSQL / PostGIS | 17.6 / 3.5.3 (+ pg_trgm 1.6, unaccent 1.1) |
| Node / TypeScript / ESLint | 24.21.0 / 6.0.3 / 8.57.1 |
| React Native | 0.87.1 (New Architecture, Hermes) |
| Maestro | 2.11.0 |

## Static analysis

| Check | Command | Result |
|---|---|---|
| Ruff | `docker compose exec api ruff check .` | 0 issues |
| Django checks (dev) | `manage.py check` | 0 issues |
| Django deploy checks (production settings) | `manage.py check --deploy --settings=config.settings.production` (dummy secret) | Only `security.W005`/`W021` (HSTS subdomains/preload: a policy decision) plus 4 cosmetic drf-spectacular enum-naming warnings |
| Migrations | `makemigrations --check --dry-run` | No changes |
| TypeScript | `npx tsc --noEmit` | 0 errors |
| ESLint | `npx eslint src __tests__` | 0 errors, 30 warnings (all `react-native/no-inline-styles`) |
| Prettier | `npx prettier --check "src/**/*.{ts,tsx}"` | 107 files differ from `.prettierrc.js`. Not enforced by lint or CI. Deferred: a whole-codebase reformat would bury the review diff (TD-10) |
| Circular imports | Not run with a dedicated tool | The `authStore` ↔ `services/api` dependency already exists and works (Babel CJS). Not verified further |

## Tests

| Suite | Result |
|---|---|
| Backend pytest (PostGIS) | **151 passed** |
| Mobile Jest | **70 passed**, 0 failed (11 live contract tests skipped unless the API URL is set) |
| Live contract (`npm run test:contract`) | **11 passed** |
| E2E Part 1 (Maestro) | Passed earlier on iOS and Android (Part 1 report) |
| E2E Part 2, iOS | **9 / 13 passed**. Failures 003, 005, 006 and 008 were harness defects: tapping a link inside the terms row, a tap swallowed by an animation, a JS env interpolation bug, and a missing back step. All fixed in `mobile/e2e/part2`. File: `e2e-ios-baseline.txt` |
| E2E Part 2, Android | Not yet run at baseline |

## Runtime baseline: API

* **Harness:** `scripts/tools/bench_api.py`, in-process (Django test client, no network). 30 samples after 3 warm-ups.
* **Rollback:** everything ran inside one transaction that was rolled back. Raw output: `bench-before.json`.
* **Scale data:** a 20,000-area synthetic city.

**Limitation:** the harness measures Django and the database, not gunicorn, the network or TLS. The `sql_ms` column is unreliable, because Django records query time at millisecond resolution, so query counts and end-to-end latency are the evidence.

| Endpoint (seed: 29 areas) | p50 ms | p95 ms | Queries | Bytes |
|---|---|---|---|---|
| parking options (destination) | 18.3 | 21.5 | 13 | 10,329 |
| map-layers (≈1.5 km bbox) | 15.1 | 18.7 | 11 | 5,138 |
| area detail | 3.9 | 4.2 | 10 | 1,805 |
| sessions list (40 sessions) | 6.5 | 10.1 | 4 | 28,577 |
| **sessions insights (40 sessions)** | **35.8** | **37.9** | **64** | 348 |
| notifications (60) | 2.0 | 2.2 | 3 | 12,248 |
| saved locations (10) | 5.9 | 8.4 | 11 | 3,874 |
| commute check | 18.8 | 22.4 | 16 | 856 |

| Endpoint (scale: 20,029 areas) | p50 ms | p95 ms | Queries | Bytes |
|---|---|---|---|---|
| parking options | 60.2 | 129.9 | 13 | 27,562 |
| map-layers | 109.0 | 179.7 | 11 | **200,448** |
| area detail | 4.6 | 8.2 | 10 | 1,805 |
| commute check | 57.8 | 129.2 | 16 | 872 |

## Runtime baseline: mobile

Not profiled with Instruments or Android Studio Profiler in this pass. Startup time, frame rate and memory were **not measured** (see TD-11). Mobile performance findings come from code review (React rendering, polling and listeners) and are labelled as such.

## Repository state at start

* Clean working tree (only git-ignored E2E output).
* No CI configuration in the repo: `scripts/run-tests.sh` is the local equivalent.
