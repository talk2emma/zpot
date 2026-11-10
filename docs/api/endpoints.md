# API reference (Parts 1 and 2)

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

## Part 2 conventions

* **Guest token.** The app sends `X-Zpot-Client: <random install token ≥ 16 chars>` with every request. Guests may create *availability* reports (`leaving`, `found`, `occupied`) and list their own reports under that token. All other Part 2 endpoints need a JWT.
* **Feature flags.** `GET /config/` returns server flags (DB `FeatureFlag` rows override settings). A disabled module returns `403 feature_disabled`.
* **Throttles** (per user/IP): reports 20/h, verifications 60/h, support 10/h, uploads 30/h. Over the limit: `429 throttled`.
* **Uploads.** JPEG/PNG/WebP up to 5 MB. Images are decoded, decompression-bomb checked and re-encoded to JPEG, which strips EXIF/GPS. **No automatic face or number-plate redaction is performed.** Files are stored privately and are only downloadable through authenticated views.
* Additional error codes used by Part 2: `parking_not_permitted`, `active_session_exists`, `session_not_active`, `invalid_planned_end`, `reminder_in_past`, `duplicate_report`, `client_token_required`, `location_mismatch`, `location_unsupported`, `not_editable`, `not_verifiable`, `observation_expired`, `own_observation`, `already_verified`, `not_appealable`, `already_appealed`, `invalid_transition`, `reason_required`, `file_required`, `file_too_large`, `unsupported_format`, `invalid_image`, `too_many_attachments`, `duplicate_label`, `use_deletion_request`, `request_in_progress`, `confirmation_required`, `already_submitted`, `already_reviewed`, `already_handled`, `feature_disabled`, `permission_denied`, `plan_limit`, `plan_required`.

## Parking sessions (JWT)

| Method | Path | Notes |
|---|---|---|
| GET | `/sessions/` | Own sessions, newest first. `?status=active\|ended\|expired`. Paginated. |
| POST | `/sessions/` | `{area_id, duration_minutes \| planned_end_at, reminder_minutes?, vehicle_class?, permit_type?, has_disabled_badge?}` → `201 {session, warnings[]}`. The server evaluates the rules. `409 parking_not_permitted` / `409 active_session_exists`. |
| GET | `/sessions/active/` | `200` the active session or `204` when there is none. |
| GET / PATCH | `/sessions/{id}/` | PATCH `{planned_end_at?, reminder_minutes?}` re-evaluates the rules and rebuilds reminders. Returns `{session, warnings}` (`planned_end_after_deadline`, `rules_unconfirmed`, `paid_hours`). |
| POST | `/sessions/{id}/end/` | `{cost_paid?, outcome?, share_departure?}`. Idempotent (`already_ended`). `share_departure` creates a `leaving` report. |
| GET | `/sessions/{id}/summary/` | Duration, cost and `estimated_saving` (null unless `cost_paid` was given; labelled as an estimate). |
| GET / POST | `/sessions/{id}/reminders/` | POST `{minutes_before}` adds a custom reminder. |
| DELETE | `/sessions/{id}/reminders/{reminder_id}/` | |

Reminders are dispatched by Celery beat every 30 s (`select_for_update(skip_locked)`, deduplicated by `reminder:{id}`). Sessions left open expire after 24 h.

## Community reports and verification

| Method | Path | Notes |
|---|---|---|
| GET | `/reports/` | Reviewers only (data_reviewer/admin). |
| POST | `/reports/` | `{type, latitude, longitude, area_id?, scope?, details?, description?, device_latitude?, device_longitude?}`. Nine types. Must be within 200 m of the area. Duplicates within 30 m / 10 min → `409`. Availability types publish a short-lived observation when the explainable trust score ≥ 0.45, otherwise `pending_review`. Rule corrections are always `pending_review` and **never change the canonical rules directly**. |
| GET | `/reports/mine/` | Own reports (account and/or guest token). |
| GET / PATCH | `/reports/{id}/` | Owner may edit the description while pending. Reviewers PATCH `{status, reason}` (rejection needs a reason; escalation creates a scout assignment). |
| POST | `/reports/{id}/attachments/` | Multipart `file`. Owner only. |
| GET | `/reports/{id}/attachments/{attachment_id}/` | Authenticated owner/reviewer stream. |
| POST | `/reports/{id}/verifications/` | `{answer: still_available\|taken\|unsure}`. One vote per voter, not on your own report (`403 own_observation`). Confirmations extend the expiry by 5 min. Contradictions ≥ 2 that outnumber confirmations → conflicting/removed. |
| POST | `/reports/{id}/appeals/` | `{message ≥ 10 chars}` on a rejected report. One appeal per report. |
| GET | `/community/me/` | Contributor summary: karma, counts, level, recent trust events. |

## Availability

| Method | Path | Notes |
|---|---|---|
| GET | `/availability/nearby/` | `latitude, longitude, radius_meters` → live observations. Expiry is enforced on every read (TTL 10 min). `prediction: "prediction_unavailable"` (no validated model). |
| GET / POST | `/availability/observations/` | `?area=`. POST delegates to report creation (same rules). |
| POST | `/verify/` | **TRD compatibility adapter** for the verification endpoint (`Deprecation: true`). |

Availability is always reported separately from legality: a free spot is not a legal spot.

## Saved places and searches (JWT)

| Method | Path | Notes |
|---|---|---|
| GET / POST | `/saved/locations/` | `current` re-evaluates the place now for a 2 h stay and flags `rules_changed`. |
| POST | `/saved/locations/import/` | `{items:[{area_id, label?}]}`, guest transfer on sign-in. Idempotent → `{imported, already_saved}`. |
| PATCH / DELETE | `/saved/locations/{id}/` | Rename or remove. |
| GET / POST | `/saved/destinations/` | |
| DELETE | `/saved/destinations/{id}/` | |
| GET / POST / DELETE | `/searches/recent/` | Retained 90 days. |

## Notifications (JWT)

| Method | Path | Notes |
|---|---|---|
| GET | `/notifications/` | Inbox plus `unread_count`. Paginated. `target` is `{route, id?}` (an app route name). |
| GET | `/notifications/{id}/` | |
| POST | `/notifications/{id}/read/` · `/notifications/read-all/` | |
| GET / PATCH | `/notifications/preferences/` | Per category. Restriction and privacy alerts are essential and always delivered. |
| GET / POST | `/devices/` | Register/upsert a push token. |
| DELETE | `/devices/{id}/` | |

`push_status` is recorded honestly: `not_configured` (no APNs/FCM credentials in this environment), `no_device` or `suppressed`. The in-app inbox is always the source of truth.

## Help and support

| Method | Path | Notes |
|---|---|---|
| GET | `/help/articles/` · `/help/articles/{id}/` | Public. `?lang=en\|pt-PT`. |
| GET / POST | `/support/tickets/` | POST `{category, description ≥ 15, contact_email (guests), include_context?, context?}`. Context keys are whitelisted. Guidance categories are high priority. Reference `ZS-######`. |
| GET | `/support/tickets/{id}/` | Owner only. Includes `staff_reply`. |
| POST | `/support/tickets/{id}/attachments/` | Image, same sanitising. |

## Privacy (JWT)

| Method | Path | Notes |
|---|---|---|
| GET / PATCH | `/privacy/consents/` | Append-only consent ledger. PATCH `{analytics?, personalised_ads?, marketing?, source?}` where `source` is `consent_prompt` or `privacy_settings` (default). Each record is stamped server-side with the current document version (`/config/` → `legal`). Terms/privacy cannot be withdrawn here (`use_deletion_request`). |
| POST | `/privacy/data-export/` | `202`. Celery builds a JSON export (expires after 7 days). |
| POST | `/privacy/deletion-request/` | `{confirm: "DELETE"}`. Reports are anonymised and the account deleted (audited). |
| GET | `/privacy/requests/` | |
| GET | `/privacy/requests/{id}/download/` | Owner only, while not expired. |

These endpoints support GDPR rights; they are not a claim of automated GDPR compliance. Lawful bases and retention periods are pending legal review.

## Scouts (role `scout` + flag `scouts`)

| Method | Path | Notes |
|---|---|---|
| GET | `/scouts/assignments/` · `/scouts/assignments/{id}/` | Own assignments, including current rules on file. |
| POST | `/scouts/assignments/{id}/submit/` | Multipart `outcome` (`matches\|differs\|no_access`), `observed_rules`, `notes`, `photos[]` (required unless `no_access`). Approval is a reviewer action in Django admin and creates `ParkingEvidence`. |

## Planning: vehicles, commute, savings (JWT)

| Method | Path | Notes |
|---|---|---|
| GET / POST | `/vehicles/` | GET creates a default "My car" from parking preferences if there is none. POST is limited by plan (Free = 1) → `403 plan_limit`. |
| PATCH / DELETE | `/vehicles/{id}/` | `{label?, vehicle_class?, permit_type? (code)}`. Editing or removing the active vehicle updates parking preferences. |
| POST | `/vehicles/{id}/activate/` | One active vehicle per user (DB constraint). Its class and permit are copied to preferences and used by every rule check. |
| GET / POST | `/commute/plans/` | `{label, name, latitude, longitude, days[0–6], arrival_minute, duration_minutes}`. Up to 10 plans. |
| PATCH / DELETE | `/commute/plans/{id}/` | |
| GET | `/commute/plans/{id}/check/` | Runs the canonical `search_parking` for the next occurrence of each day. Free: the soonest day; other days `locked: true`. |
| GET | `/sessions/insights/` | Totals for ended sessions. `estimated_savings_total` is `null` unless the driver entered costs. |
| GET | `/sessions/insights/export/` | Pro feature → `403 plan_required` (Pro cannot be purchased in this build). |
| GET | `/billing/entitlement/` | Always `{plan: "free", status: "none", provider: null, purchases_available: false, limits}`. There is no billing provider, and nothing can grant Pro. |

## Z-Trigger (experimental, flag `z_trigger`, off by default)

| Method | Path | Notes |
|---|---|---|
| GET | `/detection/config/` | Always available: `enabled`, `phase`, `requirements`, `limitations`. |
| GET | `/events/park/` | Your own last 20 detected events (private). |
| POST | `/events/park/` | `{latitude, longitude, detected_at, source, accuracy_m?}`. Private; **never** creates a public observation. `403 feature_disabled` while off. |
| DELETE | `/events/park/` | Deletes all of your Z-Trigger data → `{deleted}`. |
| POST | `/events/park/{id}/correct/` | `{latitude, longitude}` re-matches the parking area (pending events only). |
| POST | `/events/park/{id}/confirm/` | Starts nothing by itself; the app then opens Start session for the matched area. |
| POST | `/events/park/{id}/dismiss/` | |

The machine-readable checklist of every operation (auth, response schema, backend tests, mobile client, documentation) is [`endpoint-audit.json`](endpoint-audit.json). Regenerate it with `scripts/tools/api_audit.py`.
