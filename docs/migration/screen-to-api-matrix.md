# Screen → API matrix

Base: `/api/v1/`. **P1** = implemented and tested in Part 1. **P2** = contract planned for Part 2. Full schema: `/api/v1/schema/` (exported to `docs/api/openapi.yaml`).

| Screen(s) | Endpoint | Method | Auth | Phase | Status |
|---|---|---|---|---|---|
| Splash, Profile | `/health/`, `/ready/` | GET | — | P1 | ✅ |
| App start | `/config/`, `/features/` | GET | — | P1 | ✅ |
| Language, Parking preferences, Privacy | `/users/me/preferences/` | GET, PATCH | JWT | P1 | ✅ |
| Register | `/auth/register/` | POST | — | P1 | ✅ |
| Sign in | `/auth/login/` | POST | — | P1 | ✅ |
| (client) | `/auth/refresh/` | POST | — | P1 | ✅ rotation + blacklist |
| Profile › Sign out | `/auth/logout/` | POST | JWT | P1 | ✅ |
| Verify email | `/auth/verify-email/`, `/auth/resend-verification/` | POST | —, JWT | P1 | ✅ |
| Forgot password | `/auth/password-reset/`, `/auth/password-reset/confirm/` | POST | — | P1 | ✅ |
| Profile, Account | `/users/me/` | GET, PATCH, DELETE | JWT | P1 | ✅ |
| Search | `/places/autocomplete/` | GET | — | P1 | ✅ local gazetteer |
| (Search by text) | `/places/geocode/` | GET | — | P1 | ✅ |
| Explore "search this area" | `/places/reverse-geocode/` | GET | — | P1 | ✅ |
| (coverage) | `/cities/`, `/cities/{id}/`, `/cities/{id}/coverage/` | GET | — | P1 | ✅ |
| Explore results, Filters count | `/parking/options/` | GET | — | P1 | ✅ canonical search |
| Explore map overlays | `/parking/map-layers/` | GET | — | P1 | ✅ GeoJSON |
| Details, selected spot, nav return | `/parking/areas/{id}/` | GET | — | P1 | ✅ |
| Details (rules) | `/parking/areas/{id}/rules/` | GET | — | P1 | ✅ |
| Details (verification) | `/parking/areas/{id}/evidence/` | GET | — | P1 | ✅ |
| Details (vacancy) | `/parking/areas/{id}/observations/` | GET | — | P1 read / P2 write | ✅ read-only |
| (compare) | `/parking/areas/`, `/parking/compare/` | GET | — | P1 | ✅ |
| (TRD compatibility) | `/spots/nearby/` | GET | — | P1 | ✅ adapter, deprecated |
| (rules) | `/regulations/`, `/regulations/{id}/`, `/regulations/evaluate/`, `/regulations/closures/` | GET/POST | — | P1 | ✅ |
| Start/active/edit/end session, summary | `/sessions/`, `/sessions/{id}/`, `/sessions/{id}/end/` | POST/GET/PATCH | JWT | P2 | ⏳ |
| Report flow, my reports, report detail, appeal | `/reports/`, `/reports/mine/`, `/reports/{id}/appeal/` | POST/GET | optional JWT | P2 | ⏳ |
| Vacancy vote (selVac) | `/observations/`, `/observations/{id}/vote/` | POST | optional JWT | P2 | ⏳ |
| Saved | `/saved/destinations/`, `/saved/parking/` | CRUD | JWT | P2 | ⏳ |
| Notifications, prefs | `/notifications/`, `/devices/` | GET/POST/PATCH | JWT | P2 | ⏳ |
| Support / guidance problem | `/support/tickets/` | POST | optional JWT | P2 | ⏳ |
| Privacy › Download my data | `/privacy/requests/` | POST | JWT | P2 | ⏳ |
| Scouts | `/scouts/assignments/` | GET/POST | JWT (scout role) | P2 | ⏳ |
| Z-Trigger, Pro, partner, ads | — | — | — | experimental / post-MVP | ✖ not planned for MVP |
