# Code review summary

* **Branch:** `code-review/2026-11` (from `f9337ea`); 8 commits.
* **Reviewed:** the whole Zpot workspace: the React Native app, Django API, PostgreSQL/PostGIS, Celery, Docker configuration and the E2E harness. Two reviewers read the code independently; I verified every finding before it was fixed.

## Executive summary

Zpot's architecture is sound:
* One ranking implementation; business rules on the server; an explicit error envelope.
* Every user-owned resource is isolated per user. **No cross-user data access was found in the API.**

The review found and fixed **real defects in every layer**. Most could not have been seen from unit tests alone; four were only found by running the app end to end on both platforms.

**Most serious, all fixed with regression tests or E2E evidence:**
1. **Mobile privacy (M-01):** after sign-out, a guest or the next user could see the previous user's cached notifications, badge and saved places.
2. **Android (NAV-1):** `zpot://` deep links never opened the app on Android (email verification, password reset, shared and notification links).
3. **Both platforms (UX-1/1b):** the keyboard covered footer buttons (Sign in, Create account, Review). On Android this affected every form, because edge-to-edge disables `adjustResize`.
4. **API (A-01…A-06):**
   * Lists came back in random order because UUID keys were sorted by `-id`.
   * A session-start race produced an HTML 500.
   * Ending a session failed when the departure share was rejected.
   * Four malformed inputs on public endpoints produced 500s.
5. **Concurrency and privacy (A-12…A-16):**
   * Stale-session expiry ran over **all users** on every read, without locks.
   * Privacy exports could get stuck forever.
   * Erasure and export were incomplete.
6. **Performance (A-17):** the insights endpoint ran 64 queries for 40 sessions; it now runs 3.

## Work completed

| Area | Result |
|---|---|
| Backend fixes | 22 findings fixed (A-01…A-26 subset, D-01, D-04, P-01, OPS-1/2), with 19 regression tests |
| Mobile fixes | 19 findings fixed (M-01…M-22 subset, UX-1/1b/2/3, NAV-1), with 5 regression tests (Jest) |
| Dead code | 11 items removed with zero-reference evidence; 9 retained for your decision (`DEAD_CODE_AUDIT.md`) |
| Database | 3 indexes added (forward-only migrations); spatial plans verified at 20,000 areas (GiST used, under 4 ms SQL) |
| Benchmarks | Real before/after, in-process, with a rollback-only harness (`PERFORMANCE_BENCHMARKS.md`) |
| API audit | 117 operations: 117/117 with response schema, backend tests and documentation |
| Tests now | Backend **170** pytest · mobile **75** Jest + **11** live contract · E2E **13/13 + E2E-001 on iOS and Android** |

## Final review matrix

Statuses: Passed · Fixed · Remaining (see the technical debt register) · Not verified.

| Category | Mobile | API | Database |
|---|---|---|---|
| Code quality | Fixed (M-series); Remaining: Prettier drift (TD-10), untyped nested fields (TD-14) | Fixed (A-series); ruff clean | Passed: schema and constraints reviewed |
| Dead code | Fixed (4 exports, 1 dependency); 5 items await your decision | Fixed (4 classes, 1 task option); 4 await your decision | Remaining: redundant indexes need production stats (TD-13) |
| Duplication | Fixed (paged-list hook, app version); Remaining: list screen (TD-04) | Passed: one ranking path, commute check reuses it | Passed |
| Performance | Fixed at code level (map, polling, search rows); **Not verified on device** (TD-11) | Fixed (insights N+1, GeoJSON precision); Remaining: search prefetch (TD-03) | Passed: GiST used; Fixed: list/retention indexes |
| Memory and resources | Fixed (listener leak, background polling, unmount guards) | Fixed (Celery time limits, expiring ticks) | Fixed (`CONN_HEALTH_CHECKS`); Remaining: pooler and statement timeout (TD-06/07) |
| Security | Fixed (cross-user cache leak); Passed (Keychain, no secrets) | Fixed (flags, self-vote, input validation, image bomb); Remaining: client-claimed guest trust (TD-01) | Passed: per-user scoping verified |
| Data integrity | Fixed (vehicle → search prefs, invalidations) | Fixed (races, locks, best-effort share, import) | Fixed (constraint race → 409) |
| Test coverage | Fixed (+5 regression tests, E2E harness hardened) | Fixed (+19 regression tests) | Passed (real PostGIS tests); Remaining: true-concurrency tests |
| Error handling | Fixed (unhandled rejections, error states) | Fixed (`IntegrityError` → 409 envelope, 4 × 500 → 400) | Passed |
| Scalability | Remaining: list virtualisation (TD-04), native markers (TD-05) | Passed at 20k areas (P95 at most 154 ms in-process) | Passed: viewport and radius bounded |
| Documentation | Fixed (this folder, E2E README) | Fixed (`endpoints.md`, audit JSON) | Fixed (`DATABASE_PERFORMANCE_REVIEW.md`) |

## E2E (Maestro, real local API, no mocks)

| Platform | E2E-001 (Part 1) | E2E-002…012 (13 flows) | Evidence |
|---|---|---|---|
| iOS 27.0, iPhone 18 Pro simulator | Passed | **13/13 passed** in one uninterrupted run | `e2e-ios-final.txt` |
| Android API 37, Pixel_10_Pro emulator | Passed | **13/13 passed** in one uninterrupted run | `e2e-android-final.txt` |

* **Baseline before the review:** iOS 9/13; Android not run.
* **Before reaching a clean run**, every failure was diagnosed from screenshots and logs. App defects were fixed in code: NAV-1, UX-1b, UX-3 and the M-08 inbox regression. Harness defects were fixed in the flows.
* **Two failures were the app working correctly against the real clock:** Tuesday's street-cleaning ban at the seeded test street made it correctly refuse to start a session. The flows now use an area with no time-window bans.

**Test-suite defect found the same way (fixed):** 8 backend tests and 1 contract test started sessions at `s1` against the real clock, so they failed every Tuesday 07:00–09:00. They now use areas with no time windows, or ask for restricted results explicitly. 170/170 pass inside that window.

## Unresolved risks (top 5)

1. **Guest trust inputs are client-claimed** (location and install token). Vacancy spam is possible for about 10 minutes; it never affects legal rules (TD-01, product decision).
2. **No device performance profiling** was done: startup, FPS and memory are unmeasured (TD-11).
3. **No connection pooler, statement timeout or production connection budget** (TD-06/07, infrastructure).
4. **Only the custom `zpot://` scheme is registered**, with no https Universal/App Links (TD-19).
5. Retention periods and lawful bases are **pending legal review**; the app says so.

This review does not make Zpot production-ready on its own. Deployment, monitoring, a real billing provider (if Pro launches), a push provider, legal review and production data verification are all outstanding.
