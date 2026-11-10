# Codebase inventory

Review branch: `code-review/2026-11`, starting at commit `f9337ea`. The working tree was clean apart from the git-ignored E2E output.
Counts exclude generated code (`mobile/src/types/openapi.d.ts`), `node_modules`, Pods and migrations.

| Layer | Size | Tests |
|---|---|---|
| Django apps (`api/apps`, `api/config`) | 10,238 lines of Python across 16 apps | 1,939 lines in `api/tests`; 131 test functions (151 cases including parametrised ones) |
| React Native (`mobile/src`) | 7,248 lines of TS/TSX | 1,054 lines in `mobile/__tests__`: 70 component/unit tests and 11 live contract tests |
| E2E | Maestro: 1 Part 1 flow + 13 Part 2 flows | `scripts/e2e-part2.sh` |

## System map

```text
Screens (src/screens/**)  ──►  hooks (src/hooks: useParking, useAccount, useAutocomplete, useOnline)
        │                          │  TanStack Query (server state) · Zustand (client state: auth, prefs, search, report draft)
        ▼                          ▼
services/api/*.api.ts  ──  Axios client (JWT refresh, X-Zpot-Client install token, ApiError normalisation, GET retry)
        ▼
/api/v1/*  Django REST Framework views (thin)  ──►  app services / selectors  ──►  GeoDjango ORM  ──►  PostgreSQL 17 + PostGIS 3.5
                                │                                                        ▲
                                └── Celery worker + beat (Redis) ── reminders, expiry, purge, retention, data quality
```

External dependencies:
* **Map tiles:** MapLibre Native with keyless OpenFreeMap tiles. Mapbox is not configured; see ADR-002.
* **Geocoding:** local gazetteer (`cities.Place`, ADR-006). No third-party geocoder.
* **Navigation hand-off:** Apple Maps, Google Maps and Waze via deep links.
* **Email:** SMTP, which is Mailpit in development.
* **Push:** none. There are no APNs/FCM credentials, and `push_status` is recorded honestly.
* **Not integrated:** partner APIs, payments and third-party auth.

## Backend modules

| App | Lines | Models | Responsibility | Main consumers | Tests | Notes |
|---|---|---|---|---|---|---|
| core | 597 | 3 (FeatureFlag, AuditEvent, …) | Error envelope, request id, feature flags, uploads, permissions, data-quality checks | all apps | security, flags | `ZpotAPIError` is the single error path |
| accounts | 993 | 6 (+Vehicle) | Auth (JWT), profile, preferences, consents, vehicles | auth/profile/vehicles screens | test_auth, planning | |
| cities | 464 | 3 | Cities, supported areas, places gazetteer, coverage | search, autocomplete | parking_api | |
| parking | 2,061 | 5 | Canonical search (`search_parking`/`ranking_key`), map layers, area detail, compare, `/spots/nearby/` adapter | Explore, details, commute | parking_api, engine | Largest module; ranking neutrality test |
| regulations | 1,032 | 7 | Rules, restrictions, windows, tariffs, permits, closures; pure rule engine `evaluate` | parking, sessions, saved | test_engine | |
| availability | 383 | 1 | Short-lived observations, TTL enforced on read, trust score, `/verify/` adapter | Explore pins, details | reports | |
| reports | 934 | 4 | Community reports, attachments, moderation, appeals, verification | report flow | test_reports | |
| community | 133 | 2 | Verification votes, contributor trust events, `/community/me/` | Activity, Contributions | reports | |
| sessions | 973 | 3 | Sessions, reminders (beat), summary, insights | session screens | test_sessions, planning | |
| saved | 549 | 4 (+CommutePlan) | Saved places, destinations, recents, commute planner | Saved tab, commute | saved_notifications, planning | |
| notifications | 386 | 2 | Inbox, preferences, devices, templated EN/PT messages | notifications screens | saved_notifications | Push = recorded status only |
| support | 319 | 3 | Help articles, tickets, attachments | Help, Contact support | support_privacy | |
| privacy | 400 | 1 | Consents ledger, export (Celery), deletion, retention | Privacy screens | support_privacy | |
| scouts | 377 | 3 | Assignments, submissions, reviewer approval | Scout screens, admin | scouts_detection_flags | Role + flag guarded |
| detection | 232 | 1 | Z-Trigger events (experimental, off) | Z-Trigger screens | scouts_detection_flags, planning | Private events only |
| monetization | 66 | 0 | Entitlement (always Free; no billing) | Subscription, limits | planning | |

## Mobile modules

| Area | Lines / files | Responsibility | Notes |
|---|---|---|---|
| screens | 3,733 / 31 | All UI flows (onboarding, auth, explore, parking, session, report, account, support, planning, profile) | Screens call hooks/services. No direct Axios use |
| components | 1,278 / 25 | Design system (`common`), map provider abstraction (`maps`), parking presentation, forms | `ZpotMap` → `MapLibreMapView` |
| services | 735 / 25 | API client and one module per domain; Zod schemas for contract tests | Types derived from OpenAPI |
| store | 308 / 5 | Zustand: auth, prefs (persisted), search, report draft (persisted) | |
| hooks | 164 / 4 | Query hooks (parking, account), debounced autocomplete, online state | |
| navigation | 244 / 4 | Root stack, tabs, typed params, deep links | |
| features, utils, theme, i18n | ~500 | Presentation helpers, time/geo/format, tokens, EN/PT-PT catalogues (key parity checked) | |

## Competing or legacy implementations found

| Item | Status |
|---|---|
| `Part2Screen` and its `Part2` route | Kept as a documented fallback. No feature navigates to it any more; see the dead-code audit. |
| `/spots/nearby/` and `/verify/` | TRD compatibility adapters. They delegate to the canonical implementations and send a `Deprecation` header. Retained for backward compatibility. |
| `DELETE /users/me/` (Part 1) vs `POST /privacy/deletion-request/` (Part 2) | The app uses the Part 2 path; the Part 1 endpoint remains. See the dead-code audit. |

The detailed findings are in the other files of this folder.
