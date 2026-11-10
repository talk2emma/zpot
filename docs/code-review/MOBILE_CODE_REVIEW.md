# Mobile code review (React Native 0.87, TypeScript strict)

**Scope:** `mobile/src` (7.2k lines), read by an independent reviewer and verified by me. Native code (`ios/`, `android/`) was checked only for permissions and configuration. Full findings with file and line references are in the remediation log; this page summarises by theme.

## Architecture

* The layering holds (`screens → hooks → services/api → Axios`): no screen calls Axios.
* Server state is in TanStack Query; client state is in Zustand (auth, prefs, search, report draft).
* Business rules stay on the server: the app renders `category`, `legal_status` and `leave_by` enums, and never recomputes legality or cost.
* **Duplication:** list screens repeated the "load / error / empty / rows" pattern. It is now partly shared through `usePaged`. A shared `ListScreen` with `FlatList` is TD-04.
* **Error boundary:** the root `ErrorBoundary` clears the query cache on reset.

## Correctness and privacy (fixed)

* **M-01:** cross-user cache leak on sign-out (High).
* **M-02:** "View on map" lost its selection.
* **M-07:** vehicle changes ignored by search.
* **M-08:** lists cut at page 1.
* **M-12/M-15:** unhandled errors.
* **M-14:** stale caches after edits.

Each fix has a regression test where practical (`__tests__/review-regressions.test.tsx`, 4 tests).

## Hooks and resources

| Item | Status |
|---|---|
| `refetchInterval` polling while the app is backgrounded (M-03) | **Fixed:** `focusManager` ↔ `AppState` |
| Polling finished sessions and privacy requests (M-04) | **Fixed** |
| `AppState` listener leak on navigation hand-off (M-06) | **Fixed** |
| `setState` after unmount (M-13) | **Fixed** |
| GPS jitter re-keying queries (M-05) | **Fixed** (50 m threshold) |
| NetInfo: one listener per `useOnline()` caller (M-20) | **Remaining (Low):** three listeners, each idempotent. Consolidate later |
| Geolocation | Single-shot `getCurrentPosition` on focus; no `watchPosition`, no background location |
| Z-Trigger | Disabled by default (server flag); no Bluetooth or background listeners exist in the app |

## Rendering and performance (code-level)

* **Map (M-10/M-11):** zoom state previously re-rendered the whole tree, including up to 500 native markers, on every pan. Fixed with threshold-only state, constant style objects and memoised markers. Clustering below zoom 14 is done by MapLibre (native source clustering).
* **Viewport:** data is viewport-limited by the server (bbox ≤ 0.2°, ≤ 500 features), and the payload is now 6-decimal GeoJSON.
* **Search rows (M-18):** no longer remount on each keystroke.
* **Autocomplete:** debounced by 250 ms, with `AbortSignal` cancellation.
* **Selectors (M-17):** Explore reads nearly every field of the search store, so a shallow selector would save almost nothing. Not changed.
* **Not measured:** startup time, FPS and memory were not profiled on a device (TD-11). No performance gain on mobile is claimed in numbers.

## Navigation

* All 58 prototype screens are mapped (`docs/FINAL_SCREEN_COMPLETENESS.md`).
* Typed params; deep links for parking, session, report, notifications, support ticket and privacy requests.
* Guests are sent to sign in and returned to the same journey via `pendingReturn`.
* The unreachable `Part2Screen` is retained pending your decision (dead-code audit).

## Type safety

* `as unknown as` casts remain where OpenAPI declares nested `area`/`location` fields as untyped objects (M-21 → TD-14).
* Zod schemas are verified against the live API by contract tests (Part 1 + Part 2 + planning).

## Security and privacy

* Tokens are kept in the Keychain only.
* The repo or bundle contains no secrets; `env.generated.ts` is untracked.
* The only `console` call is behind `__DEV__`.
* Photos are re-encoded server-side. The in-app privacy note doesn't claim face or number-plate redaction.
* Search history and the destination stay in AsyncStorage after sign-out; this is a product decision (TD-17).

## Test coverage

* 74 Jest tests (component plus unit) and 11 live contract tests.
* Maestro: Part 1 plus 13 Part 2 flows.
* **Gaps:**
  * No tests for map interaction internals (the MapLibre native view is mocked).
  * Permission flows are only covered by E2E.
  * The splash test is timing-based (TD-18).
