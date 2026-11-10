"""API / ORM benchmark. Everything runs inside ONE transaction that is always rolled back: no data persists.

Usage (pipe into the Django shell; nothing is written to disk inside the container):
    docker compose exec -T -e BENCH_N=30 -e BENCH_SCALE=20000 api python manage.py shell --no-imports < scripts/tools/bench_api.py \
        > docs/code-review/bench-<label>.json

Phase "seed":  the development fixture (≈30 parking areas).
Phase "scale": BENCH_SCALE synthetic parking areas (rules + windows cloned from the fixture, spread over Lisbon),
               then ANALYZE, then the parking endpoints again + EXPLAIN (ANALYZE, BUFFERS) of the main spatial query.
Per endpoint: p50/p95/p99 latency (ms, in-process Django test client: no network/WSGI server), SQL query count,
SQL time, response bytes.
"""
import json
import os
import random
import statistics
import sys
import time
from datetime import timedelta
from decimal import Decimal

from django.contrib.gis.geos import LineString, Point
from django.db import connection, transaction
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

from rest_framework.throttling import SimpleRateThrottle

SimpleRateThrottle.allow_request = lambda self, request, view: True  # benchmark process only: measure the work, not 429s

N = int(os.environ.get("BENCH_N", "30"))
SCALE = int(os.environ.get("BENCH_SCALE", "20000"))
WARMUP = 3
random.seed(7)


class Rollback(Exception):
    pass


def pct(values, p):
    s = sorted(values)
    k = (len(s) - 1) * p / 100
    f = int(k)
    c = min(f + 1, len(s) - 1)
    return s[f] + (s[c] - s[f]) * (k - f)


def bench(client, label, path, n=N):
    times, last = [], None
    for i in range(n + WARMUP):
        with CaptureQueriesContext(connection) as ctx:
            t0 = time.perf_counter()
            r = client.get(path, HTTP_HOST="localhost")
            dt = (time.perf_counter() - t0) * 1000
        if i >= WARMUP:
            times.append(dt)
        last = (r, ctx)
    r, ctx = last
    return {
        "endpoint": label, "path": path, "status": r.status_code, "n": n,
        "p50_ms": round(statistics.median(times), 1), "p95_ms": round(pct(times, 95), 1),
        "p99_ms": round(pct(times, 99), 1), "queries": len(ctx.captured_queries),
        "sql_ms": round(sum(float(q["time"]) for q in ctx.captured_queries) * 1000, 1),
        "bytes": len(r.content),
    }, ctx


def bench_user():
    from apps.accounts.services import issue_tokens, register_user
    from apps.notifications.models import Notification
    from apps.parking.models import ParkingArea
    from apps.reports.models import CommunityReport
    from apps.saved.models import CommutePlan, SavedParkingLocation
    from apps.sessions.models import ParkingSession

    u = register_user(email="bench-user@zpot.invalid", password="Bench-pass-12345")
    areas = list(ParkingArea.objects.order_by("id")[:10])
    now = timezone.now()
    for i in range(40):  # ended sessions, half with a cost (insights N+1 candidate)
        a = areas[i % len(areas)]
        st = now - timedelta(days=i + 1)
        ParkingSession.objects.create(user=u, area=a, status="ended", started_at=st, planned_end_at=st + timedelta(hours=2),
                                      ended_at=st + timedelta(hours=2), category="free", legal_status="permitted",
                                      evaluated_at=st, cost_paid=Decimal("1.50") if i % 2 else None)
    for a in areas:
        SavedParkingLocation.objects.create(user=u, area=a, label=a.name, category_at_save="free")
    Notification.objects.bulk_create([Notification(user=u, category="service", template="welcome", title=f"n{i}", body="b",
                                                   dedupe_key=f"bench-{i}") for i in range(60)])
    for i in range(12):
        CommunityReport.objects.create(reporter=u, reference=f"ZR-9{i:05d}", type="incorrect_rule", status="pending_review",
                                       area=areas[i % len(areas)], location=areas[i % len(areas)].location,
                                       description="bench report text")
    plan = CommutePlan.objects.create(user=u, label="Office", name="Saldanha", location=Point(-9.145, 38.7347, srid=4326),
                                      days=[0, 1, 2, 3, 4], arrival_minute=540, duration_minutes=480)
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {issue_tokens(u)['access']}")
    return c, plan


def synth(n):
    """Clone the fixture's areas (+ rules, restrictions and their time windows) n times across Lisbon."""
    from apps.parking.models import ParkingArea
    from apps.regulations.models import ParkingRestriction, ParkingRule, ParkingTimeWindow

    tpl = list(ParkingArea.objects.prefetch_related("rules__windows", "restrictions__windows").order_by("id"))
    afields = [f for f in ParkingArea._meta.concrete_fields if not f.primary_key]
    created = 0
    for start in range(0, n, 2000):
        batch, src = [], []
        for i in range(start, min(n, start + 2000)):
            t = tpl[i % len(tpl)]
            lat, lng = random.uniform(38.70, 38.79), random.uniform(-9.21, -9.09)
            a = ParkingArea(**{f.attname: getattr(t, f.attname) for f in afields})
            a.external_ref = f"bench-{i}"
            a.location = Point(lng, lat, srid=4326)
            a.geometry = LineString((lng - 0.0006, lat), (lng + 0.0006, lat), srid=4326)
            batch.append(a)
            src.append(t)
        ParkingArea.objects.bulk_create(batch)
        rules, rwin, rests, xwin = [], [], [], []
        for a, t in zip(batch, src, strict=True):
            for r in t.rules.all():
                nr = ParkingRule(**{f.attname: getattr(r, f.attname) for f in ParkingRule._meta.concrete_fields if not f.primary_key})
                nr.area_id = a.id
                rules.append((nr, list(r.windows.all())))
            for x in t.restrictions.all():
                nx = ParkingRestriction(**{f.attname: getattr(x, f.attname) for f in ParkingRestriction._meta.concrete_fields
                                           if not f.primary_key})
                nx.area_id = a.id
                rests.append((nx, list(x.windows.all())))
        ParkingRule.objects.bulk_create([r for r, _ in rules])
        ParkingRestriction.objects.bulk_create([x for x, _ in rests])
        wf = [f for f in ParkingTimeWindow._meta.concrete_fields if not f.primary_key]
        for r, ws in rules:
            for w in ws:
                nw = ParkingTimeWindow(**{f.attname: getattr(w, f.attname) for f in wf})
                nw.rule_id, nw.restriction_id = r.id, None
                rwin.append(nw)
        for x, ws in rests:
            for w in ws:
                nw = ParkingTimeWindow(**{f.attname: getattr(w, f.attname) for f in wf})
                nw.rule_id, nw.restriction_id = None, x.id
                xwin.append(nw)
        ParkingTimeWindow.objects.bulk_create(rwin + xwin)
        created += len(batch)
    with connection.cursor() as cur:
        for tbl in ("parking_parkingarea", "regulations_parkingrule", "regulations_parkingrestriction", "regulations_parkingtimewindow"):
            cur.execute(f"ANALYZE {tbl}")
    return created


def explain(ctx, needle):
    sql = next((q["sql"] for q in ctx.captured_queries if needle in q["sql"]), None)
    if not sql:
        return None
    with connection.cursor() as cur:
        cur.execute("EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) " + sql)
        return [row[0] for row in cur.fetchall()]


PUBLIC = [
    ("parking options (destination)", "/api/v1/parking/options/?destination_latitude=38.7347&destination_longitude=-9.145"
     "&duration_minutes=120&include_paid=true"),
    ("parking map-layers (bbox ~1.5 km)", "/api/v1/parking/map-layers/?bbox=-9.155,38.728,-9.135,38.742&duration_minutes=120"),
    ("parking area detail", "/api/v1/parking/areas/{AREA}/?duration_minutes=120"),
    ("places autocomplete", "/api/v1/places/autocomplete/?q=Sal"),
    ("availability nearby", "/api/v1/availability/nearby/?latitude=38.7347&longitude=-9.145&radius_meters=900"),
    ("config", "/api/v1/config/"),
    ("help articles", "/api/v1/help/articles/?lang=en"),
]
AUTHED = [
    ("sessions list", "/api/v1/sessions/"), ("sessions active", "/api/v1/sessions/active/"),
    ("sessions insights", "/api/v1/sessions/insights/"), ("reports mine", "/api/v1/reports/mine/"),
    ("notifications", "/api/v1/notifications/"), ("saved locations", "/api/v1/saved/locations/"),
    ("community me", "/api/v1/community/me/"), ("vehicles", "/api/v1/vehicles/"),
    ("commute check", "/api/v1/commute/plans/{PLAN}/check/"),
]

out = {"n": N, "scale": SCALE, "phases": {}}
try:
    with transaction.atomic():
        from apps.parking.models import ParkingArea

        area = ParkingArea.objects.order_by("id").first().id
        authed, plan = bench_user()
        pub = APIClient()
        seed = []
        for label, path in PUBLIC:
            seed.append(bench(pub, label, path.replace("{AREA}", str(area)))[0])
        for label, path in AUTHED:
            seed.append(bench(authed, label, path.replace("{PLAN}", str(plan.id)))[0])
        out["phases"]["seed"] = {"parking_areas": ParkingArea.objects.count(), "results": seed}

        t0 = time.perf_counter()
        made = synth(SCALE)
        scale, plans = [], {}
        for label, path in PUBLIC[:3]:
            row, ctx = bench(pub, label, path.replace("{AREA}", str(area)), n=max(10, N // 2))
            scale.append(row)
            if "options" in label:
                plans["options_candidate_query"] = explain(ctx, "ST_DWithin")
            if "map-layers" in label:
                plans["map_layers_query"] = explain(ctx, "ST_Intersects")
        row, _ = bench(authed, "commute check", f"/api/v1/commute/plans/{plan.id}/check/", n=max(10, N // 2))
        scale.append(row)
        out["phases"]["scale"] = {"parking_areas": ParkingArea.objects.count(), "synthetic_created": made,
                                  "synth_seconds": round(time.perf_counter() - t0, 1), "results": scale, "plans": plans}
        raise Rollback
except Rollback:
    pass
json.dump(out, sys.stdout, indent=1)
