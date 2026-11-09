"""Pure rule-engine tests (no database). Times are Lisbon local unless stated."""

from datetime import date, datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest

from apps.regulations.services.engine import (
    AreaSpec,
    Category,
    ClosureSpec,
    Driver,
    EligibilityStatus,
    LegalStatus,
    PricingStatus,
    RestrictionSpec,
    RuleSpec,
    Window,
    evaluate,
)

L = ZoneInfo("Europe/Lisbon")
UTC = ZoneInfo("UTC")
WK = frozenset({0, 1, 2, 3, 4})
ALL = frozenset(range(7))
FREE = RuleSpec(1, "free", "Free")


def paid(rate="1.60", days=WK, s=9 * 60, e=19 * 60, inc=15, rid=2, **kw):
    return RuleSpec(
        rid, "paid", "Paid", (Window(days, s, e),), rate_per_hour=Decimal(rate), billing_increment_minutes=inc, **kw
    )


def area(*rules, restrictions=(), closures=(), status="verified"):
    return AreaSpec(1, "Europe/Lisbon", status, tuple(rules), tuple(restrictions), tuple(closures))


def at(y, mo, d, h, mi=0):
    return datetime(y, mo, d, h, mi, tzinfo=L)


# 2026-11-09 is a Monday; 2026-11-14 is a Saturday.
MON, SAT = (2026, 11, 9), (2026, 11, 14)


def test_free_all_day_whole_stay():
    ev = evaluate(area(FREE), at(*MON, 10), 120)
    assert ev.legal_status == LegalStatus.PERMITTED
    assert ev.category == Category.FREE
    assert ev.expected_total_cost == Decimal("0.00")
    assert ev.pricing_status == PricingStatus.FREE


def test_weekday_paid_window_costs_for_whole_overlap():
    ev = evaluate(area(FREE, paid()), at(*MON, 10), 120)
    assert ev.category == Category.PAID
    assert ev.expected_total_cost == Decimal("3.20")
    assert ev.paid_minutes == 120


def test_weekend_outside_paid_days_is_free_with_time_rules():
    ev = evaluate(area(FREE, paid()), at(*SAT, 10), 120)
    assert ev.category == Category.FREE_TIME_LIMITED  # free now, paid at other times
    assert ev.expected_total_cost == Decimal("0.00")
    assert "free_outside_paid_hours" in ev.explanation_codes


def test_partial_paid_overlap_is_billed_in_increments():
    # 18:20 → 20:20 : 40 min paid (18:20–19:00) → billed 45 min at 1.60/h = 1.20
    ev = evaluate(area(FREE, paid()), at(*MON, 18, 20), 120)
    assert ev.paid_minutes == 40
    assert ev.expected_total_cost == Decimal("1.20")


def test_free_time_window_before_paid_hours():
    ev = evaluate(area(FREE, paid()), at(*MON, 7), 120)
    assert ev.category == Category.FREE_TIME_LIMITED
    assert ev.expected_total_cost == Decimal("0.00")


def test_max_duration_sets_leave_by():
    ms = RuleSpec(3, "max_stay", "Maximum stay 2 hours", (), max_stay_minutes=120)
    ev = evaluate(area(FREE, ms), at(*MON, 10), 180)
    assert ev.legal_status == LegalStatus.PERMITTED_UNTIL
    assert ev.leave_by == at(*MON, 12).astimezone(UTC)
    assert ev.leave_by_reason.code == "max_stay"
    assert ev.category == Category.FREE_TIME_LIMITED


def test_max_duration_within_limit_is_fully_permitted():
    ms = RuleSpec(3, "max_stay", "Max 2h", (), max_stay_minutes=120)
    assert evaluate(area(FREE, ms), at(*MON, 10), 120).legal_status == LegalStatus.PERMITTED


def test_resident_permit_required_for_visitors():
    rule = RuleSpec(4, "permit_only", "Residents only", permit_code="res-a")
    ev = evaluate(area(rule), at(*MON, 10), 60)
    assert ev.legal_status == LegalStatus.NOT_PERMITTED
    assert ev.category == Category.RESTRICTED
    assert ev.eligibility_status == EligibilityStatus.PERMIT_REQUIRED


def test_resident_permit_holder_may_park_free():
    rule = RuleSpec(4, "permit_only", "Residents only", permit_code="res-a")
    ev = evaluate(area(rule), at(*MON, 10), 60, Driver(permits=frozenset({"res-a"})))
    assert ev.legal_status == LegalStatus.PERMITTED
    assert ev.category == Category.FREE
    assert "permit_used" in ev.explanation_codes


def test_restriction_crossing_midnight_blocks_late_arrival_and_cuts_evening_stay():
    clean = RestrictionSpec(9, "street_cleaning", "Cleaning 23:00–02:00", (Window(ALL, 23 * 60, 2 * 60),))
    # arrive 22:00 for 3 h → must leave by 23:00
    ev = evaluate(area(FREE, restrictions=[clean]), at(*MON, 22), 180)
    assert ev.legal_status == LegalStatus.PERMITTED_UNTIL
    assert ev.leave_by == at(*MON, 23).astimezone(UTC)
    # arrive 01:00 (inside the window that began the previous evening)
    ev2 = evaluate(area(FREE, restrictions=[clean]), at(2026, 11, 10, 1), 60)
    assert ev2.legal_status == LegalStatus.NOT_PERMITTED
    assert ev2.blocking_reason.code == "street_cleaning"
    # arrive 02:00 → allowed
    assert evaluate(area(FREE, restrictions=[clean]), at(2026, 11, 10, 2), 60).category == Category.FREE


def test_temporary_closure_overrides_everything():
    c = ClosureSpec(1, "Roadworks", at(*MON, 0).astimezone(UTC), at(2026, 11, 20, 23).astimezone(UTC))
    ev = evaluate(area(FREE, closures=[c]), at(*MON, 10), 60)
    assert ev.category == Category.RESTRICTED
    assert ev.blocking_reason.code == "temporary_closure"


def test_closure_starting_mid_stay_sets_leave_by():
    c = ClosureSpec(1, "Event", at(*MON, 11).astimezone(UTC), at(*MON, 15).astimezone(UTC))
    ev = evaluate(area(FREE, closures=[c]), at(*MON, 10), 180)
    assert ev.legal_status == LegalStatus.PERMITTED_UNTIL
    assert ev.leave_by_reason.code == "temporary_closure"


def test_overlapping_rules_restriction_beats_paid_and_cheapest_paid_applies():
    loading = RestrictionSpec(9, "loading", "Loading 08:00–11:00", (Window(WK, 8 * 60, 11 * 60),))
    ev = evaluate(area(FREE, paid(), restrictions=[loading]), at(*MON, 9), 60)
    assert ev.category == Category.RESTRICTED and ev.blocking_reason.code == "loading"
    two = area(FREE, paid("2.00", rid=2), paid("1.00", rid=3))
    assert evaluate(two, at(*MON, 10), 60).expected_total_cost == Decimal("1.00")


def test_dst_window_maps_to_different_utc_offsets():
    # Paid 09:00–19:00 local. 08:30 UTC is 09:30 WEST in July (paid) but 08:30 WET in January (free).
    a = area(FREE, paid())
    summer = evaluate(a, datetime(2026, 7, 6, 8, 30, tzinfo=UTC), 30)  # Monday
    winter = evaluate(a, datetime(2027, 1, 4, 8, 30, tzinfo=UTC), 30)  # Monday
    assert summer.category == Category.PAID
    assert winter.category == Category.FREE_TIME_LIMITED


def test_dst_end_night_stay_spans_25_hour_day_correctly():
    # Lisbon DST ends Sun 2026-10-25 02:00 WEST -> 01:00 WET, so that night has 25 hours.
    # From 00:00 local, 3 elapsed hours only reach 02:00 *wall* time -> the 02:00 window is just avoided;
    # 4 elapsed hours overlap it, and the deadline is 02:00 WET (= 02:00 UTC), not 01:00 UTC.
    clean = RestrictionSpec(9, "street_cleaning", "Cleaning Sun 02:00–04:00", (Window(frozenset({6}), 120, 240),))
    assert evaluate(area(FREE, restrictions=[clean]), at(2026, 10, 25, 0), 180).legal_status == LegalStatus.PERMITTED
    ev = evaluate(area(FREE, restrictions=[clean]), at(2026, 10, 25, 0), 240)
    assert ev.legal_status == LegalStatus.PERMITTED_UNTIL
    assert ev.leave_by == datetime(2026, 10, 25, 2, 0, tzinfo=UTC)  # 02:00 WET == 02:00 UTC


def test_unknown_when_area_unverified():
    ev = evaluate(area(FREE, status="unverified"), at(*MON, 10), 60)
    assert ev.legal_status == LegalStatus.UNKNOWN
    assert ev.category == Category.UNKNOWN
    assert ev.expected_total_cost is None


def test_absence_of_restriction_is_not_permission():
    ev = evaluate(area(), at(*MON, 10), 60)  # verified area but no permission rule at all
    assert ev.category == Category.UNKNOWN
    assert "no_permission_record" in ev.explanation_codes


def test_permission_gap_mid_stay_sets_leave_by_unknown():
    day_only = RuleSpec(1, "free", "Free daytime", (Window(ALL, 8 * 60, 20 * 60),))
    ev = evaluate(area(day_only), at(*MON, 19), 120)
    assert ev.legal_status == LegalStatus.PERMITTED_UNTIL
    assert ev.leave_by_reason.code == "rules_unconfirmed_after"


def test_future_rule_only_applies_from_valid_from():
    future = paid(valid_from=date(2026, 12, 1))
    assert evaluate(area(FREE, future), at(*MON, 10), 60).category == Category.FREE_TIME_LIMITED
    assert evaluate(area(FREE, future), at(2026, 12, 7, 10), 60).category == Category.PAID


def test_badge_bay_requires_badge():
    bay = RuleSpec(5, "badge_only", "Badge holders", permit_code="disabled-badge")
    assert evaluate(area(bay), at(*MON, 10), 60).eligibility_status == EligibilityStatus.BADGE_REQUIRED
    assert evaluate(area(bay), at(*MON, 10), 60, Driver(has_disabled_badge=True)).category == Category.FREE


def test_vehicle_class_scoped_restriction():
    vans = RestrictionSpec(9, "no_parking", "No vans", vehicle_classes=frozenset({"van"}))
    assert evaluate(area(FREE, restrictions=[vans]), at(*MON, 10), 60).category == Category.FREE
    assert (
        evaluate(area(FREE, restrictions=[vans]), at(*MON, 10), 60, Driver(vehicle_class="van")).category
        == Category.RESTRICTED
    )


def test_paid_with_leave_by_still_reports_cost_until_deadline():
    loading = RestrictionSpec(9, "loading", "Loading 11:00–12:00", (Window(WK, 11 * 60, 12 * 60),))
    ev = evaluate(area(FREE, paid(), restrictions=[loading]), at(*MON, 10), 180)
    assert ev.category == Category.PAID
    assert ev.leave_by == at(*MON, 11).astimezone(UTC)
    assert ev.expected_total_cost == Decimal("1.60")


def test_naive_arrival_rejected_and_bad_duration_rejected():
    with pytest.raises(ValueError):
        evaluate(area(FREE), datetime(2026, 11, 9, 10), 60)
    with pytest.raises(ValueError):
        evaluate(area(FREE), at(*MON, 10), 0)


def test_long_stay_crossing_midnight_into_next_day_paid_window():
    ev = evaluate(area(FREE, paid()), at(*MON, 22), 12 * 60)  # 22:00 → 10:00 Tue
    assert ev.paid_minutes == 60
    assert ev.expected_total_cost == Decimal("1.60")
    assert ev.departure_at - ev.arrival_at == timedelta(hours=12)
