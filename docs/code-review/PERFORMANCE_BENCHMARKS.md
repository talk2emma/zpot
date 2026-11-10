# Performance benchmarks (before / after)

* **Harness:** `scripts/tools/bench_api.py`, in-process Django test client, 30 samples after 3 warm-ups (scale phase: 15 samples).
* **Rollback:** each run is one transaction that is rolled back.
* **Raw output:** `bench-before.json` (commit `f9337ea`, before fixes) and `bench-after.json` (commit `1187ced`).
* **Same environment** for both runs: local Docker, Apple Silicon.
* **Limitations:**
  * No network, WSGI or TLS in the timings.
  * Single machine, so other load adds variance of roughly ±30 % on small numbers.
  * `sql_ms` is omitted: Django records query time at millisecond resolution, which rounds small queries to zero.

**Mobile:** no device profiling was done (TD-11), so no mobile timing is claimed.

## Seed fixture (29 areas)

| Operation | p50 before → after (ms) | p95 before → after (ms) | Queries | Bytes | Attributable change |
|---|---|---|---|---|---|
| parking options (destination) | 18.3 → 8.8 | 21.5 → 11.2 | 13 → 13 | 10,329 → 9,877 | latency drop *not* attributable: no search-code change; warm-up/variance |
| parking map-layers (bbox ~1.5 km) | 15.1 → 6.7 | 18.7 → 10.1 | 11 → 11 | 5,138 → 4,567 | 6-decimal GeoJSON (bytes only) · latency drop *not* attributable: no search-code change; warm-up/variance |
| parking area detail | 3.9 → 3.8 | 4.2 → 4.1 | 10 → 10 | 1,805 → 1,614 | 6-decimal geometry (bytes) |
| places autocomplete | 1.7 → 1.7 | 1.9 → 2.7 | 3 → 3 | 275 → 275 |  |
| availability nearby | 1.2 → 1.1 | 1.5 → 1.4 | 1 → 1 | 832 → 484 | Fewer live observations in the DB between runs (data, not code) |
| config | 0.3 → 0.3 | 0.4 → 0.4 | 0 → 0 | 1,281 → 1,281 |  |
| help articles | 0.7 → 0.6 | 0.8 → 0.8 | 1 → 1 | 2,095 → 2,095 |  |
| sessions list | 6.5 → 6.5 | 10.1 → 9.6 | 4 → 6 | 28,577 → 28,577 | +2 queries: locked stale-session expiry (A-12) |
| sessions active | 1.4 → 1.5 | 1.5 → 1.7 | 3 → 5 | 0 → 0 | +2 queries: same |
| sessions insights | 35.8 → 1.4 | 37.9 → 1.5 | 64 → 3 | 348 → 348 | **A-17 N+1 fix** |
| reports mine | 3.3 → 3.4 | 3.5 → 5.4 | 4 → 4 | 6,903 → 6,903 |  |
| notifications | 2.0 → 2.1 | 2.2 → 3.4 | 3 → 3 | 12,248 → 12,259 |  |
| saved locations | 5.9 → 5.7 | 8.4 → 7.3 | 11 → 11 | 3,874 → 3,874 |  |
| community me | 1.4 → 1.3 | 1.6 → 1.5 | 5 → 5 | 112 → 112 |  |
| vehicles | 1.1 → 1.1 | 1.3 → 1.3 | 3 → 3 | 147 → 147 |  |
| commute check | 18.8 → 8.9 | 22.4 → 11.9 | 16 → 16 | 856 → 856 | latency drop *not* attributable: no search-code change; warm-up/variance |

## Synthetic scale (20029 areas)

| Operation | p50 before → after (ms) | p95 before → after (ms) | Queries | Bytes | Attributable change |
|---|---|---|---|---|---|
| parking options (destination) | 60.2 → 60.3 | 129.9 → 153.8 | 13 → 13 | 27,562 → 26,704 |  |
| parking map-layers (bbox ~1.5 km) | 109.0 → 113.4 | 179.7 → 196.8 | 11 → 11 | 200,448 → 183,184 | 6-decimal GeoJSON (bytes only) |
| parking area detail | 4.6 → 3.9 | 8.2 → 4.4 | 10 → 10 | 1,805 → 1,614 | 6-decimal geometry (bytes) |
| commute check | 57.8 → 58.0 | 129.2 → 135.9 | 16 → 16 | 872 → 872 |  |

## Query plans (20k areas)

| Query | Index used | Execution |
|---|---|---|
| Search candidates: `ST_DWithin` 1,200 m, top 300 by `ST_Distance` | GiST `parking_parkingarea_location` (bitmap) | ≈ 3.5 ms |
| Map layers: `ST_Intersects` bbox, ≤ 500 | Same GiST index | ≈ 2 ms |

## Budgets (proposed in the brief) vs measured

| Budget | Measured (in-process) | Status |
|---|---|---|
| Standard API reads P95 < 300 ms | All seed reads P95 ≤ 12 ms; insights 1.5 ms after the fix | Met locally (no network) |
| Nearby spatial search P95 < 500 ms | Options P95 130–154 ms at 20k areas | Met locally; TD-03 for headroom |
| Zero avoidable N+1 on critical endpoints | Insights fixed; options and map-layers constant at 13 / 11 queries | Met for the reviewed endpoints |
| Viewport-limited map data | bbox ≤ 0.2°, ≤ 500 features, 183 KB at 20k areas | Met; payload is still sizeable (TD-05) |
| Mobile startup / smooth lists | Not measured | **Not verified** (TD-11) |
