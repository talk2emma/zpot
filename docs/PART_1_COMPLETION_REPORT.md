# Zpot — Part 1 completion report

**Date:** 9 Nov 2026
**Branch:** `main` (Git repository in `zpot-mobile/`)
**Machine:** macOS 27.2 arm64, 16 GB RAM, Xcode 27.2, Android Studio (JBR 25), Docker Desktop 29.9
**Machine-readable status:** [`implementation-status.json`](implementation-status.json)

Part 1 is **not** the finished app. Sessions, community reporting, saved places, notifications, support, scouts and monetisation are Part 2 or post-MVP. Their entry points route to an explicit "coming in the next build" screen.

---

## 1. Screens discovered

The source is `Interactive prototype (play me)-html/Main.dc.html`, a single design-component artboard. It was parsed rather than browsed, so screens reachable only through interaction are included.

* **58 screens**, **10 overlays** and **390 interaction bindings** (268 distinct handlers), plus 17 prototype-only "controls panel" bindings that are not part of the app.
* **116 reference screenshots** (390×844 @2x) in `docs/migration/source-screenshots/`, captured by driving the prototype's own state machine (`scripts/tools/capture-prototype-screens.cjs`).
* Inventories: [screen inventory](migration/screen-inventory.md), [interaction inventory](migration/interaction-inventory.md), [navigation matrix and flow diagram](migration/navigation-matrix.md), [screen→API matrix](migration/screen-to-api-matrix.md), [feature gap analysis](migration/feature-gap-analysis.md), and the [requirements extract](migration/source-requirements-extract.md). The BRD Google Doc, TRD PDF and business plan were all read in full.

## 2. Screens converted to React Native

| Status | Screens | Which |
|---|---|---|
| implemented | 24 | splash, language, welcome, onboarding (3 steps), location primer, location outcome (6 states), account choice, register, verify email, sign in, forgot/reset password, legal, **explore** (map, sheet, list, selected spot, layers, offline and map-failure states), **search**, **plan**, **filters**, **parking details**, navigate-with, hand-off (real deep link), profile, account, parking preferences, help, delete account |
| partial | 5 | navigation return (outcomes route to Part 2), saved (recent destinations only), activity, notification preferences (explanation only), privacy (no data export) |
| routed placeholder | 3 | start session, report type, notifications inbox |
| not started | 26 | session lifecycle (4), report flow (6), support, partner booking, Z-Trigger (5, experimental), scouts (2), Pro, commute, vehicles and insights (7, post-MVP) |

Overlays: the layers legend, sign-out confirm and OS location prompt are implemented. The other 7 are Part 2 or post-MVP.

## 3. Screens pending for Part 2

These are Part 2 MVP work:

* Sessions: start, active, edit, end, summary, plus the notification primer at session start.
* Reports: type, location, details, review, success, my reports, detail and appeal, the cancel dialog, and vacancy voting on map pins.
* Saved: save as guest or account, rename, remove.
* Notifications inbox and preferences engine.
* Support and guidance-problem tickets.
* Privacy data export.
* Scouts: list and task.

Z-Trigger stays experimental behind a flag. Pro, ads, partner booking, commute, vehicles and insights are post-MVP.

## 4. Implemented API endpoints (38)

All endpoints are under `/api/v1/` and appear in the OpenAPI schema (`docs/api/openapi.yaml`, which validates with **0 errors**).

* **System:** `GET health/ ready/ config/ features/ schema/ docs/`
* **Auth:** `POST auth/register/ login/ refresh/ logout/ verify-email/ resend-verification/ password-reset/ password-reset/confirm/`
* **Users:** `GET|PATCH|DELETE users/me/`, `GET|PATCH users/me/preferences/`
* **Geo:** `GET cities/ cities/{id}/ cities/{id}/coverage/ places/autocomplete/ places/geocode/ places/reverse-geocode/`
* **Parking:** `GET parking/options/ parking/areas/ parking/areas/{id}/ …/rules/ …/evidence/ …/observations/ (read-only) parking/map-layers/ parking/compare/ spots/nearby/` (the TRD adapter over the canonical search, marked deprecated)
* **Regulations:** `GET regulations/ regulations/{id}/ regulations/closures/`, `POST regulations/evaluate/`

## 5. Pending API endpoints (Part 2)

`sessions/`, `reports/` (+ appeal), `observations/` (writes and votes), `saved/`, `notifications/`, `devices/`, `support/tickets/`, `privacy/requests/`, `scouts/assignments/`. The contracts are listed in `migration/screen-to-api-matrix.md`.

## 6. Database models and migrations

Migrations: `accounts 0001–0002`, `cities 0001` (also creates the `postgis`, `pg_trgm` and `unaccent` extensions), `core 0001`, `parking 0001`, `regulations 0001`, `availability 0001`. `makemigrations --check` is clean.

Models:

* **accounts:** User, UserProfile, UserPreference, UserRole, DeviceRegistration, ConsentRecord
* **core:** AuditEvent
* **cities:** City, SupportedArea, Place
* **parking:** ParkingDataSource, StreetSegment, ParkingArea, ParkingEvidence, ParkingDataRevision
* **regulations:** PermitType, ParkingTariff, ParkingRule, ParkingRestriction, ParkingTimeWindow, TemporaryClosure
* **availability:** ParkingObservation

Constraints, indexes and the Part 2 extension plan are in [`database/schema.md`](database/schema.md).

**Seed.** `seed_zpot_lisbon` is idempotent and was verified by running it twice plus a test. It creates 6 areas, 12 places, 29 parking areas, 35 rules, 6 restrictions and 1 closure, covering all 10 required cases. With `--with-users` it creates `driver`, `scout` and `admin@zpot.dev` with random passwords printed once. Every record is flagged as a development fixture.

## 7. React Native components created

* **Common:** `ZpotButton`, `ZpotTextField`, `ZpotSearchBar`/`ZpotSearchInput`, `ZpotCard`, `BottomSheet`/`ZpotModal`, `ConfirmDialog`, `LoadingState`, `EmptyState`, `ErrorState`, `FilterChip`, `Toggle`, `Stepper`, `Banner`, `ListRow`, `SummaryRow`, `Screen`/`ScreenHeader`, `Toast`, `ErrorBoundary`, `Icon` (40 feather-style icons), `Logo` (official assets only)
* **Parking:** `ParkingResultCard`, `ParkingStatusBadge` (glyph + text, not colour alone), `ParkingMapMarker`, `ParkingRuleNotice`/`CheckSignsNotice`, `ParkingEvidenceLabel`. `ParkingDetailsSheet` is implemented as `SelectedSpotPanel`, and `ParkingFilterSheet` as `FiltersScreen`.
* **Forms:** `DateTimeSelector`
* **Maps:** `ZpotMap` (provider contract), `MapLibreMapView`, `MapControls`, `LayersSheet`

## 8. Navigation routes

The root native stack has 26 routes plus 4 tabs (Explore, Saved, Activity, Profile). Deep links: `zpot://verify-email?token=`, `zpot://reset-password?token=`, `zpot://parking/:id`, `zpot://explore`. See the [navigation matrix](migration/navigation-matrix.md).

## 9. Tests executed

| Suite | Command | Result |
|---|---|---|
| Backend lint | `ruff check .` | ✅ clean |
| Migrations drift | `manage.py makemigrations --check` | ✅ no changes |
| Backend tests (real PostGIS) | `pytest` | ✅ **77 passed**: engine 24, auth 18, parking/API 35 |
| OpenAPI | `spectacular --validate` | ✅ 0 errors, 2 cosmetic enum-naming warnings |
| Mobile typecheck | `tsc --noEmit` (strict) | ✅ 0 errors |
| Mobile lint | `eslint src __tests__` | ✅ 0 errors, 30 style warnings (inline styles) |
| Mobile unit/component | `jest` | ✅ **49 passed** (6 suites) |
| API contract (Zod vs live API) | `npm run test:contract` | ✅ **5 passed** |
| E2E, iOS simulator (iPhone 18 Pro, iOS 27), real API | `maestro test mobile/e2e/part1-core-journey.yaml` | ✅ **passed**: launch → guest → search "Saldanha" → set tomorrow 11:00, 3 h → API results → recommended free parking → details → Navigate → Apple Maps hand-off → return to "Welcome back" |
| E2E, Android emulator (Pixel_10_Pro, API 37), real API | same flow | ✅ **passed**, including the Google Maps hand-off and return |

## 10. Tests passing or failing

Every suite that was executed passes. No test is skipped to hide a failure. The 5 contract tests are skipped in the plain `jest` run by design (they need `ZPOT_CONTRACT_API`) and pass under `test:contract`.

## 11. Android build status

**Built and run.** `./gradlew assembleDebug` (arm64-v8a): **BUILD SUCCESSFUL**. The app was installed on the `Pixel_10_Pro` emulator (Android SDK 37) with `adb reverse` for the API and Metro, and the full E2E journey passed, including the real Google Maps hand-off and return. Screenshots are in `docs/screenshots/android/`.

Fixes needed along the way:

1. **The bootsplash generator rewrote `MainActivity.kt` imports** and broke compilation. I rewrote it using the react-native-screens ≥ 4.16 `RNScreensFragmentFactory` pattern.
2. **Gradle wrapper download timeout.** Raised `networkTimeout` to 120 s.
3. **Gradle's SDK downloader stalled** on NDK r27b at 710/836 MB. I downloaded it with resume and unpacked it to `ndk/27.1.12297006`.
4. **First launch shows Metro's bundle download.** The E2E flow tolerates this. On a cold machine, pre-warm with `curl "localhost:8081/index.bundle?platform=android"`.

## 12. iOS build status

**Built and run.** `xcodebuild` Debug for iphonesimulator: **BUILD SUCCEEDED**. The app was installed and launched on the iPhone 18 Pro simulator (iOS 27.0), with the official icon, native splash, JS bundle from Metro and a live MapLibre map with real API data. The full E2E journey passed. Screenshots are in `docs/screenshots/ios/`.

Fixes needed along the way:

1. **iOS 27 requires the UIScene lifecycle.** The RN 0.87 template crashed at launch with `NoSceneLifecycleAdoption`. I added `SceneDelegate.swift` (the RN 0.88 pattern adapted to the 0.87 factory) and a scene manifest. Cold and warm deep links are forwarded.
2. **Xcode 27 rejects pod targets below iOS 15.** The Podfile `post_install` raises them to 15.1.
3. **Zod 4 `export * as`** needed `@babel/plugin-transform-export-namespace-from`.
4. **CocoaPods' download of the 95 MB RN prebuilt core stalled.** `scripts/tools/pod-install.sh` pre-downloads it with resume support.

## 13. Backend connection status

The Docker stack is healthy: PostGIS 3.5.3, Redis, Mailpit, API and Celery worker. `/ready/` reports the database OK with 0 pending migrations and the Redis cache OK. The iOS simulator reaches the API at `localhost:8000`, verified end to end by the E2E run. Android uses `10.0.2.2:8000` plus `adb reverse`.

## 14. Missing environment dependencies

| Item | State | Impact |
|---|---|---|
| Mapbox credentials (public `pk.*` + secret download `sk.*`) | **Missing** | Mapbox SDK can't be built. MapLibre Native with OpenFreeMap tiles is used instead (fully interactive, no token). Switching is documented in `development/maps.md`. |
| Watchman | Not installed | Optional. Metro uses its fallback watcher. |
| CocoaPods | **Installed during this session** (Homebrew 1.17.0) | — |
| Maestro | Found at `~/Downloads/maestro` (2.11.0), not on PATH | `run-tests.sh` reports it as manual |
| NDK 27.1 / build-tools 37 | Installed during the first build. The NDK was fetched manually after Gradle's downloader stalled. | — |
| `postgis/postgis` arm64 image | Doesn't exist | `imresamu/postgis:17-3.5` (multi-arch) is used |
| Production geocoder, holiday calendar, verified Lisbon data | Not available | Local gazetteer and dev fixtures, clearly labelled |

## 15. Known bugs and limitations

* **Data:** all parking rules are sample fixtures. Coordinates are approximate.
* **Location:** iOS "restricted" (parental controls) is reported as "denied", because no permissions library is used.
* **Rule engine:** public holidays aren't modelled (BRD-14), and stale-rule auto-downgrade to unknown is Part 2. Ambiguous DST wall times resolve to the first occurrence.
* **Language:** the app follows the device language with an EN fallback. The BRD asks for PT-PT as the baseline (product decision pending).
* **Maps:** clustering applies below zoom 14. The map also isn't hidden while driving (BRD-25 "driving mode") — that's Part 2.
* **Lint:** 30 ESLint warnings, all inline styles.
* **OpenAPI:** 2 cosmetic enum-name collision warnings.
* **Dev tooling:** a dev-only "paste verification link" field appears in debug builds (`__DEV__` only).
* **E2E flakiness:** on Android a tap on the bottom Apply button (next to the gesture-navigation zone) was swallowed once in 4 runs. The flow re-taps if the Plan screen is still visible. On both simulators, the maps apps' own first-run location alerts can cover Zpot, so the flow dismisses them optionally. Neither is a Zpot defect.
* **Fixed during verification:** the MapLibre cluster-count layer requested a font the tile server doesn't host (404 surfaced as a dev error overlay). It now uses `Noto Sans Bold`.

## 16. Branch and commit information

Commit history on `main` in `zpot-mobile/` is in `implementation-status.json` (`git.commit`). See `git log --oneline` for the full list.

## 17. Exact next steps for Part 2

1. **Sessions.** Add `ParkingSession` and `ParkingReminder` models and services, with `leave_by` snapshotted from `engine.evaluate`. Add Celery beat reminders, `/sessions/` endpoints, and the RN start/active/edit/end/summary screens (prototype SCR-022…026) wired from details and the navigation return screen. Show the notification permission primer only at session start.
2. **Community reporting.** Add `CommunityReport`, attachments (with face and plate filtering guidance), moderation and appeal, `ParkingObservation` writes with configurable decay, and vote and conflict states. Build the RN report flow (SCR-027…033) and map vacancy pins with voting.
3. **Saved places.** Device save for guests, sync for accounts, and re-evaluation on read with rule-change flags (SCR-034, OVL-004/007/008). Reuse `authStore.pendingReturn` for "create account & save".
4. **Notifications.** `DeviceRegistration`, APNs/FCM, an inbox, and per-category preferences (SCR-036/037).
5. **Support and privacy.** Ticket case IDs (SCR-043) and data export requests.
6. **Rule data quality.** Holiday calendar, recheck triggers, stale-rule downgrade, and a two-person review workflow in admin.
7. **Mapbox.** When credentials exist, implement `MapboxMapView` against `ZpotMap` and add Android/iOS token plumbing.
8. **Real data.** Replace the fixtures with licensed Lisbon datasets and keep the seed for tests.
9. **CI.** GitHub Actions for backend (PostGIS service), mobile (tsc, jest) and the contract suite, with Maestro on a simulator runner.
10. **Product decisions.** PT-PT default language, the production geocoder, and the Pro price.
