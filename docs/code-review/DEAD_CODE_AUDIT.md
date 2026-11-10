# Dead code audit

* **Method:** two independent read-only reviewers, followed by my own grep verification of every removal (references across `api/apps`, `api/config`, `api/tests`, `mobile/src`, `mobile/__tests__` and `mobile/e2e`). Settings strings and the OpenAPI schema were also searched for backend items.
* **Policy:** code is removed only with zero references and no feature, flag, compatibility or migration role. Anything else is listed for approval.

## Removed (confirmed unused)

| Item | Location | Evidence | Risk | Verification |
|---|---|---|---|---|
| `AuthThrottle` | `api/apps/accounts/throttles.py` (file deleted) | 1 reference (its definition); not named in settings; views use `ScopedRateThrottle` | Low | ruff, pytest 170 ✓ |
| `ReasonSerializer` | `api/apps/parking/serializers.py` | Definition only; not referenced by schema decorators | Low | pytest, OpenAPI regenerated with 0 errors |
| `PointSerializer` | `api/apps/cities/serializers.py` | Definition only | Low | pytest ✓ |
| `LocationField` | `api/apps/saved/serializers.py` | Definition only | Low | pytest ✓ |
| Unreachable second `raise` | `api/apps/sessions/insights.py` | Unreachable after the first `raise` | None | pytest ✓ |
| `autoretry_for=(OSError,)` | `api/apps/privacy/tasks.py` | Could never trigger, because `process()` catches all exceptions (A-14). Replaced by an atomic claim plus stale timeout | Low | pytest ✓ |
| `formatDistance` | `mobile/src/utils/format.ts` | Definition only | Low | tsc, jest 74 ✓ |
| `minutesBetween` | `mobile/src/utils/time.ts` | Definition only | Low | tsc, jest ✓ |
| `ZpotModal` alias | `mobile/src/components/common/BottomSheet.tsx` | Definition only | Low | tsc ✓ |
| `activeMapProvider` | `mobile/src/components/maps/ZpotMap.tsx` | Definition only | Low | tsc ✓ |
| `@react-native/new-app-screen` | `mobile/package.json` + lockfile | React Native template leftover; no import in `src`, `index.js` or tests; JS-only (no native code) | Low | tsc, jest ✓ (native rebuild not required) |

## Consolidated

| Item | Decision |
|---|---|
| Hard-coded app version in two screens (`'0.2.0 (Part 2)'`, `'0.2.0'`) and `package.json` `0.0.1` | One `APP.version` constant, matching `package.json` (now `0.2.0`) |
| Stale-session expiry logic run identically from views and beat | Single `expire_stale(user=None)`; views pass the caller |

## Retained: needs your decision

| Item | Location | Evidence | Why kept |
|---|---|---|---|
| `Part2Screen` + `Part2` route + `part2.*` i18n keys | `mobile/src/screens/shared/Part2Screen.tsx`, `RootNavigator`, `navigation/types.ts` | No `navigate('Part2')` anywhere; not in deep links | It was the documented honest fallback route. Safe to delete if you agree; it is no longer reachable |
| `regulationsApi` | `mobile/src/services/api/regulations.api.ts` | No consumer in the app | Client for live public endpoints (`/regulations/*`), which may be used by a future rules screen. Delete if not planned |
| `sessionsApi.reminders/addReminder/deleteReminder`, `notificationsApi.registerDevice`, `savedApi.saveDestination/addRecent` | `mobile/src/services/api/*` | No UI caller | They match implemented server features (custom reminders, push device registration, destination saving, server recents) whose UI isn't built yet. Kept as the typed contract |
| `DELETE /users/me/` | `api/apps/accounts` | The app now uses `POST /privacy/deletion-request/` | Public endpoint (Part 1 contract). Removing it needs an external-consumer check |
| `/spots/nearby/`, `/verify/` | parking, availability | TRD compatibility adapters with a `Deprecation` header | Backward compatibility (documented) |
| `ParkingEvent.session` | `api/apps/detection/models.py` | Never written | Intended link from a confirmed Z-Trigger event to the session it starts. Wiring it is TD-08. Not dropped (migration-sensitive) |
| `CommunityReport.duplicate_of` | `api/apps/reports/models.py` | The DUPLICATE decision never sets it | Moderation should record the original. TD-09. Not dropped |
| ~30 i18n keys with no static use (`help.q1-5/a1-5`, `profile.dataExport`, …) | `mobile/src/i18n/locales/*.json` | Found by a script that cannot see templated prefixes | Low value, medium uncertainty. Listed in TD-12 |
| Duplicate/redundant indexes (D-02, D-03) | Postgres | Covered by composites, or unused `_like` indexes | Need production `pg_stat_user_indexes` before dropping |
| `ClosureFilter.filter_past` no-op, unused `_trust(…, client_token)` parameter | regulations, reports | Harmless | Low priority (TD-12) |

## Not found

* No competing screen implementations: the Part 1 Help, Privacy and Delete-account screens were replaced in Part 2, not duplicated.
* No debug-only code in production paths.
* No unused Django signals were identified; `regulations/signals.py` was not reviewed in depth.
