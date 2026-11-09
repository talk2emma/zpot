"""Canonical parking search: the single place where candidate retrieval, rule evaluation and
free-first ranking happen. Every endpoint that lists parking options (including the TRD
compatibility adapter /spots/nearby) must call `search_parking` — never re-implement ranking.

Ranking key (deterministic, commercial-neutral):
    (category rank, total cost for paid options, walking minutes, confidence, id)
Commercial partner fields are deliberately never read here.
"""

from __future__ import annotations

import base64
import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from decimal import Decimal

from django.conf import settings
from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D
from django.utils import timezone

from apps.availability.selectors import availability_for_areas
from apps.cities.selectors import coverage_for_point
from apps.regulations.services.engine import Category, Driver, Evaluation, evaluate
from apps.regulations.services.specs import area_spec

from ..models import VerificationStatus
from ..selectors import areas_with_regulations

CONFIDENCE_ORDER = {"high": 0, "medium": 1, "low": 2}
MAX_CANDIDATES = 300


@dataclass
class SearchParams:
    latitude: float
    longitude: float
    arrival_at: datetime
    duration_minutes: int
    radius_meters: int
    max_walk_minutes: int
    driver: Driver
    origin: tuple[float, float] | None = None
    max_price: Decimal | None = None
    free_only: bool = False
    include_paid: bool = False
    include_unknown: bool = True
    include_restricted: bool = False
    accessible_only: bool = False
    limit: int = 20
    offset: int = 0


@dataclass
class Option:
    area: object
    evaluation: Evaluation
    distance_meters: float
    walking_distance_meters: int
    walking_duration_minutes: int
    confidence: str
    availability: dict
    is_recommended: bool = False


@dataclass
class SearchResult:
    params: SearchParams
    coverage: dict
    options: list[Option]
    total: int
    recommended: Option | None
    summary: dict = field(default_factory=dict)
    next_offset: int | None = None


def walking(distance_m: float) -> tuple[int, int]:
    z = settings.ZPOT
    walk_m = distance_m * z["WALK_DETOUR_FACTOR"]
    return round(walk_m), max(1, math.ceil(walk_m / z["WALK_SPEED_M_PER_MIN"]))


def confidence_for(area, now=None) -> str:
    now = now or timezone.now()
    if area.verification_status == VerificationStatus.VERIFIED and area.verified_at:
        return "high" if (now - area.verified_at) <= timedelta(days=90) else "medium"
    if area.verification_status == VerificationStatus.COMMUNITY:
        return "medium"
    return "low"


def encode_cursor(offset: int) -> str:
    return base64.urlsafe_b64encode(f"o:{offset}".encode()).decode().rstrip("=")


def decode_cursor(cursor: str) -> int:
    pad = "=" * (-len(cursor) % 4)
    raw = base64.urlsafe_b64decode(cursor + pad).decode()
    if not raw.startswith("o:"):
        raise ValueError("bad cursor")
    value = int(raw[2:])
    if value < 0:
        raise ValueError("bad cursor")
    return value


def ranking_key(o: Option):
    ev = o.evaluation
    cost = (
        ev.expected_total_cost if ev.category == Category.PAID and ev.expected_total_cost is not None else Decimal("0")
    )
    return (ev.rank, cost, o.walking_duration_minutes, CONFIDENCE_ORDER[o.confidence], o.area.id)


def evaluate_candidates(areas, params: SearchParams, distances: dict[int, float] | None = None):
    now = timezone.now()
    avail = availability_for_areas([a.id for a in areas], now=now)
    out = []
    for a in areas:
        dist = (distances or {}).get(a.id, getattr(getattr(a, "distance", None), "m", 0.0))
        walk_m, walk_min = walking(dist)
        ev = evaluate(area_spec(a), params.arrival_at, params.duration_minutes, params.driver)
        out.append(
            Option(
                area=a,
                evaluation=ev,
                distance_meters=dist,
                walking_distance_meters=walk_m,
                walking_duration_minutes=walk_min,
                confidence=confidence_for(a, now),
                availability=avail.get(a.id, {"status": "unknown"}),
            )
        )
    return out


def search_parking(params: SearchParams) -> SearchResult:
    coverage = coverage_for_point(params.latitude, params.longitude)
    if coverage["status"] == "unsupported":
        return SearchResult(
            params=params, coverage=coverage, options=[], total=0, recommended=None, summary=_empty_summary()
        )

    point = Point(params.longitude, params.latitude, srid=4326)
    areas = list(
        areas_with_regulations()
        .filter(is_active=True, location__dwithin=(point, D(m=params.radius_meters)))
        .annotate(distance=Distance("location", point))
        .order_by("distance")[:MAX_CANDIDATES]
    )
    candidates = evaluate_candidates(areas, params)

    summary = _empty_summary()
    visible = []
    for o in candidates:
        cat = o.evaluation.category
        summary["candidates"] += 1
        within = o.walking_duration_minutes <= params.max_walk_minutes
        if not within:
            if cat in (Category.FREE, Category.FREE_TIME_LIMITED):
                summary["free_beyond_walk_limit"] += 1
            continue
        summary["by_category"][cat.value] += 1
        if cat == Category.RESTRICTED and not params.include_restricted:
            summary["hidden"]["restricted"] += 1
            continue
        if params.accessible_only and not o.area.is_accessible:
            summary["hidden"]["not_accessible"] += 1
            continue
        if cat == Category.UNKNOWN and not params.include_unknown:
            summary["hidden"]["unknown"] += 1
            continue
        if cat == Category.PAID:
            if params.free_only or not params.include_paid:
                summary["hidden"]["paid"] += 1
                continue
            if params.max_price is not None and o.evaluation.expected_total_cost > params.max_price:
                summary["hidden"]["over_max_price"] += 1
                continue
        visible.append(o)

    visible.sort(key=ranking_key)
    recommended = next(
        (o for o in visible if o.evaluation.category in (Category.FREE, Category.FREE_TIME_LIMITED)), None
    )
    if recommended:
        recommended.is_recommended = True
    page = visible[params.offset : params.offset + params.limit]
    next_offset = params.offset + params.limit if params.offset + params.limit < len(visible) else None
    summary["free_options"] = summary["by_category"]["free"] + summary["by_category"]["free_time_limited"]
    summary["no_free_within_limits"] = recommended is None
    return SearchResult(
        params=params,
        coverage=coverage,
        options=page,
        total=len(visible),
        recommended=recommended,
        summary=summary,
        next_offset=next_offset,
    )


def _empty_summary():
    return {
        "candidates": 0,
        "free_options": 0,
        "free_beyond_walk_limit": 0,
        "no_free_within_limits": True,
        "by_category": {c.value: 0 for c in Category},
        "hidden": {"restricted": 0, "paid": 0, "unknown": 0, "over_max_price": 0, "not_accessible": 0},
    }
