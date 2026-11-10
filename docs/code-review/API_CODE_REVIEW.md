# API code review (Django 5.2 / DRF 3.18)

**Scope:** all 16 apps (10.2k lines). The review was read-only by an independent reviewer; I verified each finding before fixing it. **Endpoints:** 117 operations. Per-operation checklist: `docs/api/endpoint-audit.json` (117/117 response schema, backend tests and docs). Summary: `docs/FINAL_API_COMPLETENESS.md`.

## Architecture

* Thin views, logic in `services`/`selectors`.
* One error path: `ZpotAPIError` plus the envelope handler, which now also maps `IntegrityError` to `409 conflict` instead of a 500.
* One ranking implementation (`search_parking` / `ranking_key`). `commute/check` reuses it rather than duplicating it.
* Monetisation entitlement is a single function (always Free).
* **Signals:** `regulations/signals.py` exists but was not reviewed in depth.

## Authorisation (verified)

**Object-level access:** every user-owned resource filters by `request.user` (or by the guest install token for guest reports) and returns 404 to non-owners. That covers sessions, reminders, saved places, destinations, commute plans, notifications, devices, tickets, privacy requests, vehicles, park events and scout assignments. Existing security tests cover cross-user access, invalid and expired JWTs, unsafe uploads, invalid coordinates, throttling and scout privileges.

**Fixed in this review:**
* **A-07:** guests could confirm their own report.
* **A-09:** feature kill switches weren't enforced.

**Remaining:** guest trust inputs are client-claimed (TD-01).

## Input validation (fixed)

| Finding | Was | Now |
|---|---|---|
| A-04 | PATCH commute with one coordinate → 500 | 400 |
| A-05 | Malformed observation filters → 500 | 400 |
| A-06 | Non-numeric area-detail coordinates → 500 | 400 |
| A-26 | Evaluate considered inactive areas | Inactive areas excluded |

All have regression tests. Existing caps verified: search radius ≤ 3,000 m, limit ≤ 50, page size ≤ 200, map bbox ≤ 0.2° with ≤ 500 features, upload ≤ 5 MB plus a pixel cap (now checked before decoding, A-24).

## Concurrency and integrity (fixed)

* **A-02:** session-start race.
* **A-03:** a rejected departure share no longer blocks ending a session.
* **A-11:** moderation lock.
* **A-12:** stale-session expiry was global, unlocked and run on read.
* **A-13:** reminder batch abort.
* **A-14:** privacy processing claim and stale timeout.

**Remaining (Low):** count-based caps without locks and reference-number collisions (TD-16).

## Performance

* N+1: insights went from 64 to 3 queries (A-17). Other reviewed list endpoints have constant query counts.
* Pagination: list ordering is now correct (A-01), with newest-first indexes.
* Search at scale is Python-bound (TD-03); see `DATABASE_PERFORMANCE_REVIEW.md`.
* **Caching:**
  * `/config/` and help articles are tiny.
  * Observations are deliberately **not** cached, so expiry is always enforced on read.
  * Parking regulations could be cached per area, but invalidation must follow admin edits and the revision trail. Not done; not needed at current latency.

## Background jobs

| Change or check | Result |
|---|---|
| Time limits | Added: soft 240 s / hard 300 s |
| Prefetch | 1 |
| Reminder tick | Expires after 25 s |
| `dispatch_due` | Idempotent and `SKIP LOCKED` |
| `expire_stale` | Now locked |
| Privacy export | Uses `on_commit` |
| Without Redis | `CELERY_TASK_ALWAYS_EAGER` defaults to true, so exports run in-request (dev only). Documented |

## Privacy

**Fixed:**
* Erasure now clears ticket text and email, report photos and tokens, and audit IP addresses (A-15).
* The export now includes every personal table (A-16).
* Z-Trigger events are purged after 30 days.

**Still open:** legal review of retention periods (stated in-app).

## Production settings

`check --deploy` against `config.settings.production` reports only:
* the HSTS `includeSubDomains`/`preload` policy (W005/W021);
* cosmetic enum-naming warnings.

**Remaining:** `/ready` exposes versions without auth (TD-15).

## Tests

* 170 backend tests, including 19 review regressions.
* Gaps:
  * True concurrency tests (two transactions in parallel) aren't automated.
  * Signal behaviour isn't specifically tested.
