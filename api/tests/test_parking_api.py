"""Integration tests against real PostGIS with the Lisbon development fixtures."""

import math

import pytest

from apps.parking.models import ParkingArea

from .conftest import next_local

pytestmark = pytest.mark.django_db

SALDANHA = {"destination_latitude": 38.7347, "destination_longitude": -9.1450}
OPTS = "/api/v1/parking/options/"


def iso(dt):
    return dt.isoformat()


def search(api, **params):
    q = {**SALDANHA, **params}
    r = api.get(OPTS, q)
    assert r.status_code == 200, r.json()
    return r.json()


def names(body):
    return [x["name"] for x in body["results"]]


def test_guest_can_search_without_auth(api, seeded):
    body = search(api, arrival_at=iso(next_local(0, 10)), duration_minutes=120)
    assert body["count"] > 0 and body["coverage"]["status"] == "full"
    assert body["coverage"]["area"]["slug"] == "saldanha"


def test_free_first_ranking_weekday_with_paid_alternatives(api, seeded):
    body = search(api, arrival_at=iso(next_local(0, 10)), duration_minutes=120, include_paid=True)
    ranks = [x["rank"] for x in body["results"]]
    assert ranks == sorted(ranks)
    cats = [x["category"] for x in body["results"]]
    assert cats[0] in ("free", "free_time_limited")
    assert "paid" in cats
    rec = next(x for x in body["results"] if x["is_recommended"])
    assert rec["id"] == body["recommended_id"] and rec["category"] in ("free", "free_time_limited")
    paid_costs = [float(x["expected_total_cost"]) for x in body["results"] if x["category"] == "paid"]
    assert paid_costs == sorted(paid_costs)


def test_paid_hidden_by_default_and_free_only(api, seeded):
    a = search(api, arrival_at=iso(next_local(0, 10)))
    assert all(x["category"] != "paid" for x in a["results"]) and a["summary"]["hidden"]["paid"] > 0
    b = search(api, arrival_at=iso(next_local(0, 10)), free_only=True)
    assert all(x["category"] in ("free", "free_time_limited", "unknown") for x in b["results"])


def test_restricted_never_listed_by_default(api, seeded):
    body = search(api, arrival_at=iso(next_local(0, 10)), include_paid=True)
    assert "Rua Pinheiro Chagas" not in names(body)  # permit-only
    assert body["summary"]["hidden"]["restricted"] >= 1


def test_permit_holder_sees_resident_street(api, seeded):
    body = search(api, arrival_at=iso(next_local(0, 10)), permit_type="lisbon-resident-saldanha")
    hit = next(x for x in body["results"] if x["name"] == "Rua Pinheiro Chagas")
    assert hit["category"] == "free" and hit["eligibility_status"] == "eligible"


def test_unknown_eligibility_labelled_and_verified_only_filter(api, seeded):
    body = search(api, arrival_at=iso(next_local(0, 10)))
    unk = next(x for x in body["results"] if x["name"] == "Rua Latino Coelho")
    assert unk["category"] == "unknown" and unk["legal_status"] == "unknown"
    assert unk["expected_total_cost"] is None and unk["confidence_label"] == "low"
    v = search(api, arrival_at=iso(next_local(0, 10)), verified_only=True)
    assert "Rua Latino Coelho" not in names(v)


def test_free_does_not_mean_vacant(api, seeded):
    body = search(api, arrival_at=iso(next_local(0, 10)))
    free = [x for x in body["results"] if x["category"] == "free"]
    assert free and all(x["availability_status"] == "unknown" for x in free)


def test_time_window_changes_classification(api, seeded):
    # Av. Duque de Ávila: paid Mon–Fri 09–19 → free on Saturday
    sat = search(api, arrival_at=iso(next_local(5, 10)), include_paid=True)
    mon = search(api, arrival_at=iso(next_local(0, 10)), include_paid=True)
    cat = {x["name"]: x["category"] for x in sat["results"]}
    assert cat["Av. Duque de Ávila"] == "free_time_limited"
    assert {x["name"]: x["category"] for x in mon["results"]}["Av. Duque de Ávila"] == "paid"


def test_restriction_crossing_into_stay_sets_leave_by(api, seeded):
    # Rua Tomás Ribeiro loading bay Mon–Sat 08–11 → arrive Mon 06:30 for 3h: leave by 08:00
    body = search(api, arrival_at=iso(next_local(0, 6, 30)), duration_minutes=180)
    hit = next(x for x in body["results"] if x["name"] == "Rua Tomás Ribeiro")
    assert hit["category"] == "free_time_limited" and hit["leave_by"] is not None
    assert hit["leave_by_reason"]["code"] == "loading"


def test_max_price_filter(api, seeded):
    body = search(api, arrival_at=iso(next_local(0, 10)), include_paid=True, max_price="3.50")
    assert all(float(x["expected_total_cost"]) <= 3.5 for x in body["results"] if x["category"] == "paid")
    assert body["summary"]["hidden"]["over_max_price"] >= 1  # garage 2.20/h x 2h


def test_max_walk_filter_and_distance(api, seeded):
    body = search(api, arrival_at=iso(next_local(0, 10)), max_walk_minutes=3, include_paid=True)
    assert all(x["walking_duration_minutes"] <= 3 for x in body["results"])
    wide = search(api, arrival_at=iso(next_local(0, 10)), max_walk_minutes=30, include_paid=True)
    assert wide["count"] >= body["count"]


def test_postgis_distance_matches_haversine(api, seeded):
    body = search(api, arrival_at=iso(next_local(0, 10)), include_paid=True, max_walk_minutes=30)
    for x in body["results"]:
        la, lo = x["location"]["latitude"], x["location"]["longitude"]
        dlat, dlon = math.radians(la - 38.7347), math.radians(lo + 9.1450)
        a = (
            math.sin(dlat / 2) ** 2
            + math.cos(math.radians(38.7347)) * math.cos(math.radians(la)) * math.sin(dlon / 2) ** 2
        )
        hav = 2 * 6371008.8 * math.asin(math.sqrt(a))
        assert abs(x["distance_meters"] - hav) < max(3, hav * 0.01)


def test_ranking_is_commercially_neutral(api, seeded):
    p = {"arrival_at": iso(next_local(0, 10)), "include_paid": True, "max_walk_minutes": 30}
    before = [x["id"] for x in search(api, **p)["results"]]
    ParkingArea.objects.update(is_commercial_partner=True, partner_offer="Sponsored!")
    ParkingArea.objects.filter(name__icontains="garage").update(is_commercial_partner=False)
    after = search(api, **p)
    assert [x["id"] for x in after["results"]] == before
    assert any(x["commercial"] for x in after["results"])


def test_unsupported_city_returns_coverage_status(api, seeded):
    r = api.get(OPTS, {"destination_latitude": 41.1496, "destination_longitude": -8.611})
    body = r.json()
    assert r.status_code == 200 and body["coverage"]["status"] == "unsupported" and body["results"] == []
    assert "Porto" in body["coverage"]["note"]


@pytest.mark.parametrize(
    "params,field",
    [
        ({}, "destination_latitude"),
        ({"destination_latitude": 38.7}, "destination_longitude"),
        ({**SALDANHA, "free_only": True, "include_paid": True}, "include_paid"),
        ({**SALDANHA, "max_price": "2"}, "max_price"),
        ({**SALDANHA, "duration_minutes": 5}, "duration_minutes"),
        ({**SALDANHA, "radius_meters": 99999}, "radius_meters"),
        ({**SALDANHA, "arrival_at": "2020-01-01T10:00:00Z"}, "arrival_at"),
        ({**SALDANHA, "cursor": "!!!"}, "cursor"),
        ({**SALDANHA, "destination_latitude": 123}, "destination_latitude"),
    ],
)
def test_search_validation(api, seeded, params, field):
    r = api.get(OPTS, params)
    assert r.status_code == 400
    assert field in r.json()["error"]["details"], r.json()


def test_cursor_pagination(api, seeded):
    p = {"arrival_at": iso(next_local(0, 10)), "include_paid": True, "max_walk_minutes": 30, "limit": 2}
    first = search(api, **p)
    assert len(first["results"]) == 2 and first["next_cursor"]
    second = search(api, **p, cursor=first["next_cursor"])
    assert not {x["id"] for x in first["results"]} & {x["id"] for x in second["results"]}


def test_spots_nearby_adapter_uses_canonical_ranking(api, seeded):
    r = api.get("/api/v1/spots/nearby/", {"lat": 38.7347, "lng": -9.1450})
    assert r.status_code == 200 and r["Deprecation"] == "true"
    spots = r.json()["spots"]
    assert 0 < len(spots) <= 5 and r.json()["ranking"] == "free_first"
    canon = search(api, destination_latitude=38.7347, destination_longitude=-9.1450, max_walk_minutes=30, limit=5)
    assert [s["id"] for s in spots] == [x["id"] for x in canon["results"]]


def test_area_detail_rules_evidence_observations(api, seeded):
    area = ParkingArea.objects.get(external_ref="dev-lisbon-s2")
    d = api.get(f"/api/v1/parking/areas/{area.id}/", {"arrival_at": iso(next_local(0, 10))}).json()
    assert d["name"] == "Av. Duque de Ávila" and d["category"] == "paid"
    assert any("Maximum stay" in line for line in d["rule_lines"])
    assert d["data_source"]["is_development_fixture"] is True
    rules = api.get(f"/api/v1/parking/areas/{area.id}/rules/").json()
    assert {r["kind"] for r in rules["rules"]} == {"free", "paid", "max_stay"}
    ev = api.get(f"/api/v1/parking/areas/{area.id}/evidence/").json()
    assert ev["evidence"] and ev["evidence"][0]["source"]["is_development_fixture"]
    obs = api.get(f"/api/v1/parking/areas/{area.id}/observations/").json()
    assert obs["observations"] == []
    assert api.get("/api/v1/parking/areas/999999/").status_code == 404


def test_closure_area_restricted_and_closures_endpoint(api, seeded):
    area = ParkingArea.objects.get(external_ref="dev-lisbon-m3")
    d = api.get(f"/api/v1/parking/areas/{area.id}/", {"arrival_at": iso(next_local(0, 10))}).json()
    assert d["category"] == "restricted" and d["blocking_reason"]["code"] == "temporary_closure"
    closures = api.get("/api/v1/regulations/closures/", {"city": "lisbon"}).json()
    assert any(c["area"] == area.id for c in closures)


def test_future_restriction_applies_only_later(api, seeded):
    area = ParkingArea.objects.get(external_ref="dev-lisbon-a2")
    soon = api.get(f"/api/v1/parking/areas/{area.id}/", {"arrival_at": iso(next_local(0, 10))}).json()
    later = api.get(f"/api/v1/parking/areas/{area.id}/", {"arrival_at": iso(next_local(0, 10, weeks_ahead=5))}).json()
    assert soon["category"] in ("free", "free_time_limited") and later["category"] == "paid"


def test_regulations_list_detail_evaluate(api, seeded):
    lst = api.get("/api/v1/regulations/", {"city": "lisbon", "kind": "paid"}).json()
    assert lst["results"] and all(r["kind"] == "paid" for r in lst["results"])
    rid = lst["results"][0]["id"]
    assert api.get(f"/api/v1/regulations/{rid}/").json()["tariff"]["currency"] == "EUR"
    area = ParkingArea.objects.get(external_ref="dev-lisbon-v4")
    ev = api.post(
        "/api/v1/regulations/evaluate/",
        {"area_id": area.id, "arrival_at": iso(next_local(0, 10)), "duration_minutes": 60},
        format="json",
    ).json()
    assert ev["eligibility_status"] == "badge_required"
    ok = api.post(
        "/api/v1/regulations/evaluate/",
        {"area_id": area.id, "arrival_at": iso(next_local(0, 10)), "duration_minutes": 60, "has_disabled_badge": True},
        format="json",
    ).json()
    assert ok["category"] == "free"


def test_map_layers_geojson(api, seeded):
    r = api.get(
        "/api/v1/parking/map-layers/", {"bbox": "-9.155,38.728,-9.135,38.742", "arrival_at": iso(next_local(0, 10))}
    )
    fc = r.json()
    assert r.status_code == 200 and fc["type"] == "FeatureCollection" and fc["features"]
    layers = {f["properties"]["layer"] for f in fc["features"]}
    assert {"free", "paid", "restrict", "unknown"} <= layers
    assert api.get("/api/v1/parking/map-layers/", {"bbox": "-10,38,-8,40"}).status_code == 400


def test_compare(api, seeded):
    ids = list(
        ParkingArea.objects.filter(external_ref__in=["dev-lisbon-s1", "dev-lisbon-s6"]).values_list("id", flat=True)
    )
    body = api.get(
        "/api/v1/parking/compare/", {"ids": ",".join(map(str, ids)), "arrival_at": iso(next_local(0, 10))}
    ).json()
    assert body["results"][0]["category"] == "free" and body["best_id"] == body["results"][0]["id"]
    assert api.get("/api/v1/parking/compare/", {"ids": str(ids[0])}).status_code == 400


def test_cities_places_and_coverage(api, seeded):
    cities = api.get("/api/v1/cities/").json()
    lisbon = next(c for c in cities if c["slug"] == "lisbon")
    assert lisbon["is_supported"] and lisbon["timezone"] == "Europe/Lisbon"
    cov = api.get(f"/api/v1/cities/{lisbon['id']}/coverage/").json()
    assert {a["slug"] for a in cov["areas"]} >= {"saldanha", "marvila", "alcantara"}
    ac = api.get("/api/v1/places/autocomplete/", {"q": "alcantara"}).json()["results"]  # accent-insensitive
    assert any(p["name"] == "Alcântara" for p in ac)
    porto = api.get("/api/v1/places/autocomplete/", {"q": "porto"}).json()["results"][0]
    assert porto["coverage"]["status"] == "unsupported"
    geo = api.get("/api/v1/places/geocode/", {"q": "LX Factory"}).json()
    assert geo["coverage"]["area"]["slug"] == "alcantara"
    assert api.get("/api/v1/places/geocode/", {"q": "zzzz"}).status_code == 404
    rev = api.get("/api/v1/places/reverse-geocode/", {"latitude": 38.7347, "longitude": -9.1452}).json()
    assert rev["nearest_place"]["name"] == "Saldanha" and rev["coverage"]["area"]["slug"] == "saldanha"


def test_system_endpoints(api, seeded):
    assert api.get("/api/v1/health/").json()["status"] == "ok"
    ready = api.get("/api/v1/ready/")
    assert ready.status_code == 200 and ready.json()["checks"]["database"]["postgis_version"]
    cfg = api.get("/api/v1/config/").json()
    assert cfg["map"]["style_url"].startswith("https://") and cfg["search_defaults"]["max_walk_minutes"] == 10
    feats = {f["key"]: f for f in api.get("/api/v1/features/").json()["features"]}
    assert feats["parking_search"]["enabled"] and feats["parking_sessions"]["phase"] == "mvp"
    assert api.get("/api/v1/schema/").status_code == 200
    assert api.get("/api/v1/docs/").status_code == 200


def test_rule_changes_are_audited(seeded):
    from apps.parking.models import ParkingDataRevision
    from apps.regulations.models import ParkingRule

    r = ParkingRule.objects.filter(kind="paid").first()
    n = ParkingDataRevision.objects.filter(area_id=r.area_id).count()
    r.label = "Changed"
    r.save()
    assert ParkingDataRevision.objects.filter(area_id=r.area_id, action="updated").count() == 1
    assert ParkingDataRevision.objects.filter(area_id=r.area_id).count() == n + 1


def test_seed_is_idempotent(seeded):
    from django.core.management import call_command

    from apps.regulations.models import ParkingRule

    before = (ParkingArea.objects.count(), ParkingRule.objects.count())
    call_command("seed_zpot_lisbon", verbosity=0)
    assert (ParkingArea.objects.count(), ParkingRule.objects.count()) == before
