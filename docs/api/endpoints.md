# API reference (Part 1)

* Base URL: `http://localhost:8000/api/v1/` (Android emulator: `http://10.0.2.2:8000/api/v1/`)
* Interactive docs: `/api/v1/docs/` (Swagger)
* Schema: `/api/v1/schema/`, exported to [`openapi.yaml`](openapi.yaml) and validated with 0 errors

## Conventions

* JSON only. Datetimes are ISO 8601. A naive `arrival_at` is interpreted in the city's local time (Europe/Lisbon).
* Authentication: `Authorization: Bearer <access>`. Parking, places, cities and regulations are public (guest-first).
* Errors always use this envelope:
  ```json
  {"error": {"code": "validation_error", "message": "Some fields are invalid.", "details": {"field": ["…"]}, "request_id": "…"}}
  ```
  Codes: `validation_error`, `not_authenticated`, `authentication_failed`, `token_not_valid`, `invalid_credentials`, `token_expired`, `token_invalid`, `email_taken`, `not_found`, `throttled` (with `details.retry_after_seconds`), `already_verified`.
* Every response carries an `X-Request-ID` header (client-supplied or generated).

## System

| Method | Path | Notes |
|---|---|---|
| GET | `/health/` | Liveness only. No dependencies touched. |
| GET | `/ready/` | DB plus PostGIS version, pending migrations and cache. Returns 503 when not ready. |
| GET | `/config/` | Public config: map style, search defaults, data notice, feature flags. |
| GET | `/features/` | Feature flags with `phase` (part1, part2, experimental). |
| GET | `/schema/`, `/docs/` | OpenAPI 3 and Swagger UI. |

## Auth and users

| Method | Path | Body | Success |
|---|---|---|---|
| POST | `/auth/register/` | `email, password, accept_terms, display_name?, language?` | 201 `{user, tokens}` and a verification email |
| POST | `/auth/login/` | `email, password` | 200 `{user, tokens}`; 401 `invalid_credentials` |
| POST | `/auth/refresh/` | `refresh` | 200 `{access, refresh}` (rotated; the old one is blacklisted) |
| POST | `/auth/logout/` | `refresh` or `everywhere=true` | 204 |
| POST | `/auth/verify-email/` | `token` | 200 user; 400 `token_expired` or `token_invalid` |
| POST | `/auth/resend-verification/` | — (JWT) | 202; 409 if already verified |
| POST | `/auth/password-reset/` | `email` | 202 always (no account enumeration) |
| POST | `/auth/password-reset/confirm/` | `token, new_password` | 200; the token is single-use |
| GET / PATCH | `/users/me/` | `display_name` | user |
| DELETE | `/users/me/` | `confirm: "DELETE"`, `password?` | 204 (erasure plus token revocation) |
| GET / PATCH | `/users/me/preferences/` | preference fields | preferences (consent changes also go to the ledger) |

## Places and cities

| Method | Path | Query |
|---|---|---|
| GET | `/places/autocomplete/` | `q`, `limit`, `latitude`/`longitude` (bias). Each result carries `coverage`. |
| GET | `/places/geocode/` | `q` → best match or 404 |
| GET | `/places/reverse-geocode/` | `latitude`, `longitude` → nearest place, distance, coverage |
| GET | `/cities/`, `/cities/{id}/`, `/cities/{id}/coverage/` | Coverage includes `SupportedArea` GeoJSON |

## Parking

### `GET /parking/options/`

The canonical search.

| Param | Type | Default | Rules |
|---|---|---|---|
| `destination_latitude`, `destination_longitude` | float | — | Must be sent together |
| `latitude`, `longitude` | float | — | Device position. Used when there's no destination. |
| `arrival_at` | datetime | now | ≥ now − 1 h, ≤ now + 90 d |
| `duration_minutes` | int | 120 | 15–1440 |
| `radius_meters` | int | 1200 | 100–3000 |
| `max_walk_minutes` | int | 10 | 1–30 |
| `free_only` | bool | false | Can't be combined with `include_paid` |
| `include_paid` | bool | false | |
| `max_price` | decimal | — | Requires `include_paid` |
| `verified_only`, `accessible_only`, `include_restricted` | bool | false | |
| `vehicle_class` | enum | car | car, motorcycle, van, ev |
| `permit_type` | slug | — | e.g. `lisbon-resident-saldanha` |
| `has_disabled_badge` | bool | false | |
| `limit`, `cursor` | int, opaque | 20 | `next_cursor` comes back in the response |

The response contains `query`, `coverage`, `summary` (counts by category and hidden counts), `recommended_id`, `count`, `next_cursor`, `results[]` and `disclaimer`. Each result has these fields:

```
id name address kind location geometry category rank is_recommended
legal_status(permitted|permitted_until|not_permitted|unknown)
pricing_status(free|paid|unknown|not_applicable)
eligibility_status(eligible|permit_required|badge_required|vehicle_not_allowed|unknown)
availability_status(unknown|recently_reported_available|reported_occupied|conflicting_reports)
expected_total_cost currency arrival_at duration_minutes leave_by leave_by_reason blocking_reason has_paid_periods
walking_distance_meters walking_duration_minutes distance_meters
verified_at verification_status data_source evidence_status confidence_label is_accessible
explanation_codes recommendation_reason{code,params,text} commercial (disclosure only)
```

### Other parking endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/parking/areas/` | Filters: `city`, `supported_area`, `kind`, `verification_status`, `bbox`. Cursor pagination. |
| GET | `/parking/areas/{id}/` | Option fields plus `rule_lines`, `supported_area`, `evidence_count`. Takes the stay parameters. |
| GET | `/parking/areas/{id}/rules/` | Structured rules, restrictions, upcoming closures and plain-language lines |
| GET | `/parking/areas/{id}/evidence/` | Evidence items with source |
| GET | `/parking/areas/{id}/observations/` | Active observations only. Read-only in Part 1. |
| GET | `/parking/map-layers/` | `bbox` (≤ 0.2° per side) plus stay → GeoJSON FeatureCollection (`category`, `layer`, `rate_per_hour`, `leave_by`) |
| GET | `/parking/compare/` | `ids=1,2[,…5]` plus stay → ranked results and `best_id` |
| GET | `/spots/nearby/` | **TRD compatibility adapter** (`lat`, `lng`, `radius`). Delegates to the canonical search, returns the top 5 by free-first ranking, and sends `Deprecation: true` plus a `Link` to the successor. |

## Regulations

| Method | Path | Notes |
|---|---|---|
| GET | `/regulations/` | Filters: `area`, `city`, `kind` |
| GET | `/regulations/{id}/` | Rule with windows, tariff, permit and source |
| POST | `/regulations/evaluate/` | `{area_id, arrival_at?, duration_minutes, vehicle_class?, permit_type?, has_disabled_badge?}` → evaluation |
| GET | `/regulations/closures/` | Current and upcoming. `city`, `area`, `active_at`, `include_past`. |

## Part 2 contracts (not implemented)

Sessions, reports, observation votes, saved places, notifications and devices, support tickets, privacy requests, and scout assignments. See `docs/migration/screen-to-api-matrix.md`.
