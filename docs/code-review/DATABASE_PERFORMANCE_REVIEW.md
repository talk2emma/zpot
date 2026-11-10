# Database performance review (PostgreSQL 17.6, PostGIS 3.5.3)

**Environment:** local Docker (`imresamu/postgis:17-3.5`, arm64) with `pg_trgm` and `unaccent` installed. Nothing here was run against production.

**Data:** the development fixture is tiny (29 parking areas). Scale evidence therefore comes from `scripts/tools/bench_api.py`. It clones the fixture's areas, rules, restrictions and time windows **20,000 times** across Lisbon inside a single transaction, runs `ANALYZE` and `EXPLAIN (ANALYZE, BUFFERS)`, and then **always rolls back**. No data is left behind. Raw output: `bench-before.json` and `bench-after.json`.

## Schema

| Area | Finding | Action |
|---|---|---|
| Keys | UUID PKs on user-facing records (sessions, reports, notifications, tickets, privacy requests, park events); bigint elsewhere | Kept. List ordering is now explicit (A-01) |
| Integrity | Partial unique constraints already guard the critical invariants: one active session per user, one active vehicle per user (new), one vote per voter/token per observation, unique saved place per user, notification dedupe key per user | Verified. The session-start race now maps the constraint violation to a 409 (A-02) |
| Check constraints | `area_verified_needs_date`, session time ordering | Kept |
| Cascades | User-owned data cascades on account deletion. Community reports are `SET_NULL` and anonymised. `ParkingArea.city` is PROTECT but `StreetSegment.city` is CASCADE (D-05) | D-05 deferred (inconsistent, not data-losing) |
| Retention | Exports 7 days, search history 90 days, sessions 365 days. **Z-Trigger events had no purge** | Added a 30-day purge (`ZTRIGGER_EVENT_RETENTION_DAYS`) |

## Indexes

There are 229 indexes (3.3 MB) on the dev database. **Spatial:** every geography/geometry column used in a filter has a GiST index: `parkingarea.location`, `parkingarea.geometry`, observations, reports, places, supported-area and city boundaries, commute plans, destinations, search history and park events.

| ID | Finding | Decision |
|---|---|---|
| D-01 | Notifications list by `(user, -created_at)`; only `(user, read_at)` existed | **Added** `notif_user_created` (migration `zpot_notifications/0002`) |
| — | Session history by `(user, -started_at)` | **Added** `session_user_started` |
| D-04 | Hourly `retention_cleanup` filters `ParkingSession.ended_at` with no index | **Added** `session_ended_at` |
| D-02 | Single-column FK indexes covered by composites (observation.area, notification.user, session.user, report.reporter, parkingarea.city, reminder.fire_at) | **Deferred.** Dropping them saves only write overhead at current volumes and needs production `pg_stat_user_indexes` evidence first |
| D-03 | `varchar_pattern_ops` "_like" indexes on `communityreport.client_token` and `auditevent.action` with no LIKE queries; `accounts_user` has both `email` unique and `lower(email)` unique | **Deferred** for the same reason. Documented in the technical debt register |

All index changes are additive, forward-only migrations; no historical migration was rewritten. On a large production table they should be built with `CREATE INDEX CONCURRENTLY`, either through a `SeparateDatabaseAndState` migration or during a maintenance window; see the technical debt register.

## Query plans at 20,000 areas

### Search candidates: `parking_options`

This is `ST_DWithin(location, point, 1200m)` ordered by `ST_Distance`, limited to 300.

```
Bitmap Index Scan on parking_parkingarea_location_…_id   rows=2976
  Index Cond: (location && _st_expand(point, 1200))
Bitmap Heap Scan … Filter: is_active AND st_dwithin(…)    rows=915 (582 removed by the exact-distance recheck)
Sort: top-N heapsort on st_distance                      300 rows
Execution Time ≈ 3.5 ms
```

* The GiST index is used, and geography (metres) is used correctly; there is no degrees-as-metres error.
* The planner estimates 2 rows against 915 actual for `ST_DWithin` on geography. This doesn't change the plan (index scan plus a top-N sort), but it does affect join choices. Deferred: revisit with production statistics.

### Map layers: `parking_map_layers`

```
Bitmap Index Scan on parking_parkingarea_location_…_id   rows=1178
Bitmap Heap Scan … Filter: is_active AND st_intersects(location, bbox)   rows=552
Sort by name, Limit 500
Execution Time ≈ 2 ms
```

* Viewport-limited, with the bbox capped at 0.2° and results capped at 500.

**Conclusion:** at 20,000 areas the SQL is not the bottleneck; both spatial queries execute in under 4 ms. End-to-end time is dominated by Python, as the profile below shows.

## ORM / N+1

| Endpoint | Before | After | Note |
|---|---|---|---|
| `GET /sessions/insights/` (40 sessions) | **64 queries**, p50 35.8 ms | **3 queries**, p50 1.4 ms | A-17. One `values_list` query plus one query for the cheapest alternative tariff per supported area |
| `GET /parking/options/` | 13 queries (constant regardless of candidate count) | 13 | Prefetch of rules, windows, tariffs and permits. No N+1 |
| `GET /parking/map-layers/` | 11 | 11 | Same |
| `GET /sessions/`, `/sessions/active/` | 4 / 3 | 6 / 5 | +2 queries per call: the savepoint and `SELECT … FOR UPDATE SKIP LOCKED` that make stale-session expiry safe (A-12). An accepted cost for correctness |

### Search profile at 20,000 areas

From `cProfile`, 10 requests:

| Stage | Time (ms per request) | Share |
|---|---|---|
| Prefetching related rule, window, tariff and permit rows (≈ 18,000 model instances) | ≈ 67 | ≈ 50 % |
| Evaluating the rules in Python | ≈ 21 | ≈ 15 % |
| SQL wait | ≈ 12 | ≈ 9 % |

* p95 is 130–154 ms, within the 500 ms spatial-search budget.
* The remedy would be `Prefetch(to_attr=…)` lists through `regulations.services.specs`, or `.only()` field trimming. That is a cross-cutting change to correctness-critical code, so it is **deferred** with measurements (TD-03).

## Connections and concurrency

* `CONN_MAX_AGE=60` now pairs with **`CONN_HEALTH_CHECKS=True`**, so pooled connections survive a database restart instead of failing the next request.
* Dev `max_connections` is 100. Observed: 1 active and 13 idle connections (runserver, Celery worker with concurrency 2, beat, and test sessions).
* Production sizing must budget gunicorn workers × threads + Celery concurrency + beat + admin. No pooler (PgBouncer) is configured. Deferred to infrastructure (TD-06).
* No statement timeout is set. Deliberately **not** added globally, because the same connection runs migrations. A role-level `statement_timeout` for the web role is recommended (TD-07).

Concurrency fixes, each with a regression test in `api/tests/test_review_regressions.py` where one was practical:

| Fix | What changed |
|---|---|
| Session-start race | Unique constraint violation → 409 |
| Stale-session expiry | Locked with `SKIP LOCKED`, scoped to the caller on read paths |
| Reminder dispatch | Per-reminder savepoints, so one database error no longer aborts the whole batch |
| Moderation | Row lock |
| Privacy processing | Atomic claim with a conditional `UPDATE` |
| Session end | A rejected departure share no longer rolls back the end |

## Data freshness

* Expiry is enforced on read wherever availability appears: `availability_for_areas` (`expires_at > now` plus `state_of`), `_live()` and `ObservationSerializer.state`.
* No cache holds observations.
* A delayed purge worker therefore cannot surface stale vacancies; the reviewer confirmed this independently.

## Migrations

* `makemigrations --check`: clean.
* New migrations are additive only: `accounts/0003_vehicle`, `zpot_saved/0002_commuteplan`, `zpot_sessions/0002` (2 indexes), `zpot_notifications/0002` (1 index).
* No data migrations, no destructive operations, and no history rewritten.
