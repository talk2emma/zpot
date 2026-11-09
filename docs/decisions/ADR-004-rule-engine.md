# ADR-004 — Parking rule engine

**Decision.** `apps/regulations/services/engine.py` is a pure function, `evaluate(AreaSpec, arrival, duration, Driver) → Evaluation`. It has no ORM, no I/O and no clock.

1. **Separate concerns.** Permission rules (free, paid, permit_only, badge_only), limits (max_stay), prohibitions (restrictions), date-bounded closures and time windows are distinct models.
2. **No record ≠ permission.** A segment with no active permission rule is UNKNOWN. An unverified area is UNKNOWN. Neither is ever free.
3. **Whole-stay evaluation.** The stay is split at every rule boundary computed in the city's timezone with `zoneinfo`, which handles DST and windows that cross midnight. The first non-permitted segment gives `leave_by` and a reason. If the stay is blocked at arrival, the result is `not_permitted`.
4. **Precedence.** closure > restriction (unless the permit is exempt) > permit/badge > paid (cheapest wins) > free.
5. **Cost.** Each contiguous paid run is billed in tariff increments, with a minimum charge per run.

**Consequences.** It's fast and deterministic, and covered by 24 unit tests including DST nights. Public holidays aren't modelled yet (Part 2).
