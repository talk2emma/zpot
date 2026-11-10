# Remediation log

* **Severity:** Critical / High / Medium / Low, as defined in the review brief.
* **Tests:** "Regression test" means a test that failed before the fix and passes after it.
* **Test files:** backend `api/tests/test_review_regressions.py`; mobile `mobile/__tests__/review-regressions.test.tsx`.
* **Commits:** on branch `code-review/2026-11`: `1187ced` (backend), `c286289` (mobile and dead code), plus E2E harness fixes.

## Backend

| ID | Sev | Root cause | Files | Fix | Test | Remaining risk |
|---|---|---|---|---|---|---|
| A-01 | High | `CursorPagination.ordering="-id"` overrode each view's `order_by`; on UUID keys lists came back in random order | `core/pagination.py`, views (sessions, reports, notifications, tickets) | Per-view `cursor_ordering` (newest first, `id` tie-break); indexes added | `test_a01…` ✓ | None known |
| A-02 | High | Two concurrent session starts passed the pre-check; the partial unique index raised `IntegrityError`, an HTML 500 outside the envelope | `sessions/services.py`, `core/exceptions.py` | Savepoint maps to `409 active_session_exists`. The global handler maps any `IntegrityError` to `409 conflict` and logs the detail server-side only | `test_a02…` ×2 ✓ | — |
| A-03 | High | A rejected departure share (duplicate, unsupported area) rolled back the session end | `sessions/services.py` | Share runs in a savepoint and is best-effort; `shared_departure=False` plus a `share_skipped` event | `test_a03…` ✓ | — |
| A-04 | High | PATCH commute with one coordinate → `KeyError` → 500 | `saved/commute.py` | `validate()` requires both or neither | `test_a04…` ✓ | — |
| A-05 | High | `?area=abc` / malformed `bbox` → 500 on a public endpoint | `availability/views.py` | Filter serializer (int area; bbox validated, ≤0.2°) | `test_a05…` ×3 ✓ | — |
| A-06 | High | Area detail `float(latitude)` on raw query params → 500 | `parking/views.py`, `parking/serializers.py` | `AreaDetailQuerySerializer` with bounded floats | `test_a06…` ✓ | — |
| A-07 | Medium | Guests could confirm their own report, and rotating tokens could extend a vacancy indefinitely | `reports/services.py` | Self-vote by the same token is 403; only signed-in confirmations extend expiry | `test_a07…` ✓ | Token rotation can still add guest "taken" votes; see TD-01 |
| A-09 | Medium | Feature flags for reports, sessions and support were never enforced on the server | `core/features.py` (`FeatureGateMixin`), views | Create endpoints return `403 feature_disabled` when off. Reading your own data and ending a session still work. Privacy rights are not gated | `test_a09…` ×3 ✓ | — |
| A-10 | Medium | Guest-to-account import: one removed area made the whole batch fail (400), so guest places never transferred | `saved/serializers.py`, `saved/views.py` | Item serializer without an existence check; missing or inactive areas are skipped | `test_a10…` ✓ | — |
| A-11 | Medium | Two reviewers could apply the same decision twice (duplicate trust events) | `reports/services.py` | `select_for_update` re-read inside `moderate` | Not unit-testable without true concurrency | Low |
| A-12 | Medium | `expire_stale()` ran for **all users** on every session list GET, unlocked, and could overwrite a concurrent end | `sessions/services.py`, `sessions/views.py` | Scoped to the caller on read paths; `SKIP LOCKED`; atomic | `test_a12…` ✓ | +2 queries per call (see benchmarks) |
| A-13 | Medium | A DB error in one reminder aborted the whole dispatch batch every tick | `sessions/services.py` | Per-reminder savepoint; state reset if rolled back | Existing reminder tests ✓ | — |
| A-14 | Medium | Privacy processing had no lock; a worker crash left PROCESSING forever, blocking exports; the configured retry could never fire | `privacy/services.py`, `tasks.py` | Atomic claim via conditional `UPDATE`; RECEIVED/PROCESSING older than 1 h is failed and a new export is allowed; the misleading retry is removed | Existing privacy tests ✓ | — |
| A-15 | Medium | Erasure kept ticket text and contact email, report photos and tokens, and audit IPs | `privacy/services.py` | All cleared or deleted; reports stay anonymised as community data | `test_deletion_request…` ✓ | Legal review of retention still pending (stated in-app) |
| A-16 | Medium | Export omitted vehicles, commute plans, Z-Trigger events, votes, trust events, devices and privacy requests; no Z-Trigger retention | `privacy/services.py`, settings | Added to the export; 30-day `ParkingEvent` purge | Existing export test ✓ | — |
| A-17 | Medium (perf) | Insights called `summary()` per session (≈2 queries each), and minutes covered only 200 rows while counts covered all | `sessions/insights.py` | One `values_list` plus one alternatives query per supported area | `test_a17…` (≤12 queries) ✓; benchmark 64→3 | — |
| A-18 | Low | Editing a session cancelled the driver's custom reminders | `sessions/services.py` | Custom reminders are re-timed against the new plan | `test_a18…` ✓ | — |
| A-24 | Low | Pillow only rejects images above 2 × `MAX_IMAGE_PIXELS`, so an 80 MP image could still be decoded | `core/uploads.py` | Pixel check before `load()`; JPEG draft decoding | Upload tests ✓ | — |
| A-26 | Low | `/regulations/evaluate/` evaluated inactive areas | `regulations/views.py` | `is_active=True` | `test_a26…` ✓ | — |
| D-01, D-04 | Low | Missing indexes for the new orderings and hourly retention | models + migrations | `notif_user_created`, `session_user_started`, `session_ended_at` | migrations check ✓ | Build `CONCURRENTLY` on large tables |
| P-01 | Low (perf) | GeoJSON sent at full float precision | `parking/serializers.py` | 6 decimals (≈0.11 m) | `test_p01…` ✓; map-layers −9 % bytes at scale | — |
| OPS-1 | Medium | No Celery time limits; 30 s reminder ticks could pile up | `settings/base.py` | Soft 240 s / hard 300 s, prefetch 1, reminder tick `expires=25` | Workers restarted healthy | — |
| OPS-2 | Low | Persistent DB connections without health checks fail after a DB restart | `settings/base.py` | `CONN_HEALTH_CHECKS=True` | pytest ✓ | — |

## Mobile

| ID | Sev | Root cause | Files | Fix | Test | Remaining risk |
|---|---|---|---|---|---|---|
| M-01 | High (privacy) | Sign-out, expiry and deletion never cleared the query cache; a guest or the next user could see the previous user's inbox, badge and saved places | `services/queryClient.ts` (new), `store/authStore.ts`, `AccountScreens`, `ExploreScreen` | `queryClient.clear()` on every identity change; lists guarded on `authed` | `M-01` ✓ | — |
| M-03 | Medium | TanStack Query thinks a React Native app is always focused, so every poll ran in the background; nothing refreshed on return | `services/queryClient.ts` | `focusManager` wired to `AppState`; `refetchOnWindowFocus: true` | Reviewed; no RN focus unit test | Behaviour change: stale queries refetch when the app returns to the foreground (intended) |
| M-04 | Medium | Ended sessions polled every 30 s; finished privacy requests every 10 s | `SessionScreens`, `SupportScreens` | Conditional `refetchInterval` | Reviewed | — |
| M-02 | Medium | "View on map" cleared its own selection (`setView` resets `selectedId`) | `ParkingDetailsScreen` | Order swapped | `M-02` ✓ | — |
| M-05 | Medium | GPS jitter on every Explore focus re-keyed searches and discarded the user's pan | `ExploreScreen` | Ignore moves under 50 m | Reviewed | — |
| M-06 | Medium | Hand-off `AppState` listener leaked (one per tap) and fired on a transient inactive→active | `NavigationPickerScreen` | Single ref-held subscription, removed on unmount, requires `background` first | Part 1 navigation E2E (pending re-run) | — |
| M-07 | Medium | Changing vehicle or permit didn't affect searches (they read local prefs) | `PlanningScreens` | Server's active vehicle mirrored into prefs on save, activate and delete | `M-07` ✓ | — |
| M-08 | Medium | Notifications, history, reports and tickets showed only page 1 | `hooks/usePaged.ts` (new), 4 screens, `services/api/paging.ts` | Infinite query plus "Load more". **Regression caught by Android E2E-008:** the paged inbox had lost the 30 s poll, so new reminders didn't appear while it was open. Restored (`refetchInterval`, paused in the background) | `M-08` ✓; E2E-008 ✓ | Lists are not virtualised (TD-04) |
| M-10/M-11 | Medium (perf) | Every pan or zoom re-rendered the whole map tree and all native markers; layer style objects were recreated every render | `MapLibreMapView`, `ParkingMapMarker` | Threshold boolean state; module-constant styles; `React.memo` markers | Code-level; **not profiled** (TD-11) | — |
| M-12, M-15 | Low | Unhandled rejection on "already active → open"; vehicle errors were silent | `SessionScreens`, `PlanningScreens` | try/catch + toast; `ErrorState` | Reviewed | — |
| M-13, M-16 | Low | `setState` after unmount; fly-to never reset after deselect | `NavigationPickerScreen`, `ExploreScreen` | Guards | Reviewed | — |
| M-14 | Low | Missing invalidations (history after edit; contributions and insights after end) | `SessionScreens` | Added | Reviewed | — |
| M-18 | Low (perf) | `Row` component defined inside render: rows remounted on every keystroke | `SearchScreen` | Render function | Search tests ✓ | — |
| M-22 | Low | Hard-coded user-visible strings and app version | Several | i18n keys (EN/PT parity 941/941); `APP.version` | i18n parity script ✓ | — |
| UX-1 | Medium | (Found by E2E) the keyboard covered footer buttons in iOS sheet screens | `components/common/Screen.tsx` | `keyboardVerticalOffset` measured in window | E2E-005 | — |
| UX-2 | Medium | (Found by E2E) Saved remove/rename on a network error: unhandled rejection, stuck dialog | `AccountScreens` | Error-safe actions | E2E-007 ✓ | — |
| UX-1b | High | (Found by the Android E2E run) Under edge-to-edge (`edgeToEdgeEnabled=true`) the window doesn't resize, so `adjustResize` did nothing and **the keyboard hid Sign in, Create account, Review and every other footer button on Android** | `components/common/Screen.tsx` | Keyboard-height padding on both platforms (iOS `Will*`, Android `Did*` events); KeyboardAvoidingView removed (it also mis-measured in iOS sheets) | Android + iOS E2E | — |
| NAV-1 | High | (Found by the Android E2E run) **No `zpot://` intent filter on Android**: email verification, password reset, shared parking links and notification deep links never opened the app on Android. The Android Studio guide wrongly said the filter existed | `android/app/src/main/AndroidManifest.xml` | VIEW + DEFAULT + BROWSABLE intent filter for `zpot` | `adb am start zpot://parking/1` → `Status: ok`; E2E | Universal/App Links (https) not configured (TD-19) |
| UX-3 | Medium | (Found by E2E-003) After verifying the email, Continue went back into the completed sign-up form, and the pending journey was dropped before verification | `features/auth/useAuthActions.ts`, `screens/auth/VerifyEmailScreen.tsx` | Pending journey kept through verification; Continue resumes it (or the main tabs) | `auth.test.tsx` new test ✓; E2E-003 ✓ | — |

## Investigated, not a defect

* **"Allow Zpot to find… nearby devices" prompt on Android 17.** It comes from `ACCESS_LOCAL_NETWORK`, which only React Native's **debug** manifest declares, for the Metro dev server. Release builds don't request it. The E2E launch accepts it.

## E2E harness (not app defects)

* Terms-checkbox test ID.
* `retryTapIfNoChange` on the language step.
* Observation check reads `output.obsId` directly.
* Back step from the session screen.
* iOS: sign out first because the Keychain survives `clearState`.
* The benchmark harness disables throttling in-process only.
