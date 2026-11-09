# ADR-005 — Free-first, commercially neutral ranking

**Decision.** `ranking_key = (category rank, paid cost, walk minutes, confidence, id)`. Category ranks are free 0, free-with-time-rules 1, paid 2, unknown 3, restricted 4. The recommended option is the first free or free-with-time-rules result. Commercial fields (`is_commercial_partner`, `partner_offer`, `ev_charging_note`) are returned only in a separate `commercial` disclosure object and are never read by ranking code.

**Guard.** `tests/test_parking_api.py::test_ranking_is_commercially_neutral` flips partner flags across all areas and asserts the order is unchanged.
