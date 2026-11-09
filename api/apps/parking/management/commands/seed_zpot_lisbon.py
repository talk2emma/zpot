"""Seed deterministic Lisbon development fixtures.

ALL DATA HERE IS DEVELOPMENT SAMPLE DATA. It is NOT a statement of real Lisbon parking regulations.
Coordinates are approximate; rules mirror the cases designed in the HTML prototype.

Idempotent: every object is keyed by a stable slug/external_ref; rules for fixture areas are
rebuilt inside a transaction, so re-running never duplicates data.
"""

import math
import secrets
from datetime import datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from django.contrib.auth import get_user_model
from django.contrib.gis.geos import LineString, MultiPolygon, Point, Polygon
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import Role, UserPreference, UserProfile, UserRole
from apps.cities.models import City, CoverageLevel, Place, PlaceKind, SupportedArea
from apps.parking.models import (
    AreaKind,
    EvidenceKind,
    EvidenceStatus,
    ParkingArea,
    ParkingDataRevision,
    ParkingDataSource,
    ParkingEvidence,
    SourceKind,
    VerificationStatus,
)
from apps.regulations.models import (
    ParkingRestriction,
    ParkingRule,
    ParkingTariff,
    ParkingTimeWindow,
    PermitKind,
    PermitType,
    TemporaryClosure,
)

LISBON_TZ = ZoneInfo("Europe/Lisbon")
WK, WK6, ALL = [0, 1, 2, 3, 4], [0, 1, 2, 3, 4, 5], [0, 1, 2, 3, 4, 5, 6]


def h(x):
    return int(x * 60)


def circle(lat, lng, radius_m, n=24):
    dlat = radius_m / 111_320
    dlng = radius_m / (111_320 * math.cos(math.radians(lat)))
    pts = [(lng + dlng * math.cos(2 * math.pi * i / n), lat + dlat * math.sin(2 * math.pi * i / n)) for i in range(n)]
    pts.append(pts[0])
    return MultiPolygon(Polygon(pts, srid=4326), srid=4326)


def segment(lat, lng, bearing_deg, length_m):
    dlat = length_m / 2 / 111_320 * math.cos(math.radians(bearing_deg))
    dlng = length_m / 2 / (111_320 * math.cos(math.radians(lat))) * math.sin(math.radians(bearing_deg))
    return LineString((lng - dlng, lat - dlat), (lng + dlng, lat + dlat), srid=4326)


def square(lat, lng, side_m):
    d1 = side_m / 2 / 111_320
    d2 = side_m / 2 / (111_320 * math.cos(math.radians(lat)))
    return Polygon(
        ((lng - d2, lat - d1), (lng + d2, lat - d1), (lng + d2, lat + d1), (lng - d2, lat + d1), (lng - d2, lat - d1)),
        srid=4326,
    )


AREAS = [
    # slug, name, lat, lng, coverage, note
    ("saldanha", "Saldanha", 38.7344, -9.1455, CoverageLevel.FULL, ""),
    ("arroios", "Arroios", 38.7322, -9.1365, CoverageLevel.FULL, ""),
    ("alvalade", "Alvalade", 38.7515, -9.1430, CoverageLevel.FULL, ""),
    ("avenidas-novas", "Avenidas Novas", 38.7405, -9.1480, CoverageLevel.FULL, ""),
    (
        "marvila",
        "Marvila",
        38.7385,
        -9.1035,
        CoverageLevel.PARTIAL,
        "Some parking data in Marvila is still being mapped.",
    ),
    (
        "alcantara",
        "Alcântara",
        38.7025,
        -9.1780,
        CoverageLevel.MAPPING,
        "Limited verified parking data in Alcântara so far.",
    ),
]

PLACES = [
    # slug, name, subtitle, lat, lng, kind, popular
    ("saldanha", "Saldanha", "Praça Duque de Saldanha, Lisboa", 38.7347, -9.1450, PlaceKind.NEIGHBOURHOOD, False),
    ("campo-pequeno", "Campo Pequeno", "Avenidas Novas, Lisboa", 38.7425, -9.1465, PlaceKind.LANDMARK, True),
    ("alvalade", "Alvalade", "Av. da Igreja, Lisboa", 38.7520, -9.1432, PlaceKind.NEIGHBOURHOOD, False),
    ("mercado-de-arroios", "Mercado de Arroios", "Arroios, Lisboa", 38.7330, -9.1352, PlaceKind.LANDMARK, True),
    ("lx-factory", "LX Factory", "Alcântara, Lisboa", 38.7036, -9.1784, PlaceKind.LANDMARK, True),
    ("hub-criativo-do-beato", "Hub Criativo do Beato", "Marvila, Lisboa", 38.7358, -9.1043, PlaceKind.LANDMARK, True),
    ("avenidas-novas", "Avenidas Novas", "Lisboa", 38.7400, -9.1480, PlaceKind.NEIGHBOURHOOD, False),
    ("marvila", "Marvila", "Lisboa", 38.7400, -9.1030, PlaceKind.NEIGHBOURHOOD, False),
    ("alcantara", "Alcântara", "Lisboa", 38.7030, -9.1780, PlaceKind.NEIGHBOURHOOD, False),
    ("arroios", "Arroios", "Lisboa", 38.7322, -9.1365, PlaceKind.NEIGHBOURHOOD, False),
    ("porto", "Porto", "Porto, Portugal", 41.1496, -8.6110, PlaceKind.CITY, False),
    ("faro", "Faro", "Faro, Portugal", 37.0194, -7.9304, PlaceKind.CITY, False),
]

# ref, area, name, lat, lng, bearing, length_m, status, verified_days_ago, case dict
SPOTS = [
    (
        "s1",
        "saldanha",
        "Rua Filipe Folque",
        38.7351,
        -9.1478,
        100,
        110,
        "verified",
        7,
        {"free": True, "restrict": ("street_cleaning", "Street cleaning, Tue 07:00–09:00", [1], h(7), h(9))},
    ),
    (
        "s2",
        "saldanha",
        "Av. Duque de Ávila",
        38.7356,
        -9.1430,
        95,
        140,
        "verified",
        4,
        {"free": True, "paid": (WK, h(9), h(19), "1.60"), "max_stay": (240, WK, h(9), h(19))},
    ),
    (
        "s3",
        "saldanha",
        "Rua Tomás Ribeiro",
        38.7328,
        -9.1452,
        10,
        100,
        "verified",
        12,
        {"free": True, "restrict": ("loading", "Loading bay, Mon–Sat 08:00–11:00", WK6, h(8), h(11))},
    ),
    (
        "s4",
        "saldanha",
        "Rua Pinheiro Chagas",
        38.7338,
        -9.1488,
        80,
        100,
        "verified",
        8,
        {"permit": "lisbon-resident-saldanha"},
    ),
    ("s5", "saldanha", "Rua Latino Coelho", 38.7330, -9.1430, 20, 90, "unverified", None, {}),
    (
        "s6",
        "saldanha",
        "Saldanha garage (sample operator)",
        38.7342,
        -9.1458,
        None,
        40,
        "verified",
        3,
        {
            "car_park": True,
            "paid": (ALL, 0, 1440, "2.20"),
            "accessible": True,
            "partner": (
                "Reserve a guaranteed bay before you arrive. Partner price matches the drive-up tariff in this sample.",
                "4 chargers, 22 kW (sample)",
            ),
        },
    ),
    (
        "s7",
        "saldanha",
        "Rua Andrade Corvo",
        38.7322,
        -9.1470,
        95,
        110,
        "community",
        6,
        {"free": True, "max_stay": (120, ALL, 0, 1440)},
    ),
    (
        "a1",
        "alvalade",
        "Av. da Igreja",
        38.7522,
        -9.1430,
        90,
        140,
        "verified",
        5,
        {"free": True, "paid": (WK, h(9), h(19), "1.20")},
    ),
    (
        "a2",
        "alvalade",
        "Rua Acácio de Paiva",
        38.7508,
        -9.1442,
        85,
        110,
        "verified",
        10,
        {"free": True, "future_paid": (21, WK, h(9), h(19), "1.20")},
    ),
    (
        "a3",
        "alvalade",
        "Rua Marquesa de Alorna",
        38.7497,
        -9.1418,
        5,
        100,
        "verified",
        8,
        {"free": True, "restrict": ("market", "Street market, Sat 06:00–14:00", [5], h(6), h(14))},
    ),
    ("a4", "alvalade", "Av. Rio de Janeiro", 38.7535, -9.1395, 80, 110, "unverified", None, {}),
    ("a5", "alvalade", "Rua Luís Augusto Palmeirim", 38.7545, -9.1450, 90, 100, "community", 7, {"free": True}),
    (
        "r1",
        "arroios",
        "Av. Almirante Reis",
        38.7332,
        -9.1347,
        5,
        140,
        "verified",
        4,
        {"free": True, "paid": (WK, h(9), h(20), "1.60")},
    ),
    (
        "r2",
        "arroios",
        "Rua Pascoal de Melo",
        38.7318,
        -9.1385,
        95,
        120,
        "verified",
        4,
        {"free": True, "paid": (WK6, h(9), h(19), "1.20")},
    ),
    (
        "r3",
        "arroios",
        "Rua de Arroios",
        38.7305,
        -9.1368,
        10,
        100,
        "verified",
        7,
        {"free": True, "restrict": ("bus_lane", "Bus lane, every day 07:00–21:00", ALL, h(7), h(21))},
    ),
    (
        "r4",
        "arroios",
        "Rua Morais Soares",
        38.7348,
        -9.1318,
        85,
        110,
        "verified",
        6,
        {"free": True, "paid": (WK, h(9), h(19), "1.20")},
    ),
    (
        "r5",
        "arroios",
        "Rua Febo Moniz",
        38.7275,
        -9.1355,
        60,
        90,
        "verified",
        13,
        {"free": True, "restrict": ("street_cleaning", "Street cleaning, nightly 23:00–02:00", ALL, h(23), h(2))},
    ),
    ("m1", "marvila", "Rua do Açúcar", 38.7392, -9.1012, 90, 120, "verified", 11, {"free": True}),
    ("m2", "marvila", "Rua Capitão Leitão", 38.7405, -9.1025, 60, 100, "unverified", None, {}),
    (
        "m3",
        "marvila",
        "Av. Infante D. Henrique lay-by",
        38.7362,
        -9.1028,
        20,
        140,
        "verified",
        2,
        {"free": True, "closure": (-2, 11, "Roadworks closure (sample).")},
    ),
    (
        "v1",
        "avenidas-novas",
        "Av. de Berna",
        38.7408,
        -9.1495,
        95,
        140,
        "verified",
        4,
        {"free": True, "paid": (WK, h(9), h(19), "1.60")},
    ),
    (
        "v2",
        "avenidas-novas",
        "Rua Marquês de Sá da Bandeira",
        38.7388,
        -9.1520,
        10,
        110,
        "verified",
        8,
        {"free": True, "max_stay": (180, ALL, 0, 1440)},
    ),
    (
        "v3",
        "avenidas-novas",
        "Av. Elias Garcia",
        38.7400,
        -9.1468,
        95,
        120,
        "verified",
        5,
        {"free": True, "paid": (WK, h(9), h(19), "1.60")},
    ),
    (
        "v4",
        "avenidas-novas",
        "Accessible bay, Av. da República",
        38.7414,
        -9.1462,
        None,
        12,
        "verified",
        3,
        {"badge": True, "accessible": True},
    ),
    (
        "v5",
        "avenidas-novas",
        "Campo Pequeno car park (sample operator)",
        38.7430,
        -9.1458,
        None,
        60,
        "verified",
        3,
        {
            "car_park": True,
            "paid": (ALL, 0, 1440, "1.90"),
            "partner": (
                "Reserve a bay and charge your EV while you're at Campo Pequeno.",
                "8 chargers, 11–50 kW (sample)",
            ),
        },
    ),
    (
        "v6",
        "avenidas-novas",
        "Rua Dr. Nicolau Bettencourt",
        38.7432,
        -9.1490,
        0,
        100,
        "verified",
        6,
        {"free": True, "event_restrict": (4, "Event day closure (future, sample)")},
    ),
    ("c1", "alcantara", "Rua da Cozinha Económica", 38.7042, -9.1772, 90, 110, "unverified", None, {}),
    ("c2", "alcantara", "Rua Rodrigues Faria", 38.7030, -9.1792, 20, 100, "unverified", None, {}),
    ("c3", "alcantara", "Av. da Índia", 38.6995, -9.1782, 85, 140, "community", 9, {"free": True}),
]


class Command(BaseCommand):
    help = "Seed deterministic Lisbon DEVELOPMENT fixtures (sample data — not real regulations)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--with-users", action="store_true", help="Create local dev users (driver/scout/admin @zpot.dev)."
        )

    @transaction.atomic
    def handle(self, *args, **opts):
        now = timezone.now()
        lisbon = self._cities()
        areas = self._areas(lisbon)
        self._places(lisbon)
        src = self._sources()
        permits = self._permits(lisbon)
        counts = self._spots(lisbon, areas, src, permits, now)
        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded Lisbon development fixtures: {len(areas)} areas, {counts['spots']} parking areas, "
                f"{counts['rules']} rules, {counts['restrictions']} restrictions, {counts['closures']} closures."
            )
        )
        self.stdout.write(
            self.style.WARNING("These are DEVELOPMENT FIXTURES — not confirmed live parking regulations.")
        )
        self._help()
        if opts["with_users"]:
            self._users()
            self._scout_tasks()

    # ------------------------------------------------------------------ cities & coverage
    def _cities(self):
        lisbon_boundary = MultiPolygon(Polygon.from_bbox((-9.235, 38.690, -9.085, 38.800)), srid=4326)
        lisbon, _ = City.objects.update_or_create(
            slug="lisbon",
            defaults={
                "name": "Lisboa",
                "country_code": "PT",
                "timezone": "Europe/Lisbon",
                "currency": "EUR",
                "center": Point(-9.1393, 38.7223, srid=4326),
                "boundary": lisbon_boundary,
                "is_supported": True,
                "launch_note": "Pilot city.",
            },
        )
        for slug, name, lat, lng in (("porto", "Porto", 41.1496, -8.6110), ("faro", "Faro", 37.0194, -7.9304)):
            City.objects.update_or_create(
                slug=slug,
                defaults={
                    "name": name,
                    "country_code": "PT",
                    "timezone": "Europe/Lisbon",
                    "center": Point(lng, lat, srid=4326),
                    "boundary": MultiPolygon(
                        Polygon.from_bbox((lng - 0.08, lat - 0.06, lng + 0.08, lat + 0.06)), srid=4326
                    ),
                    "is_supported": False,
                    "launch_note": f"Zpot isn't available in {name} yet. The pilot covers Lisbon only.",
                },
            )
        return lisbon

    def _areas(self, city):
        out = {}
        for slug, name, lat, lng, cov, note in AREAS:
            out[slug], _ = SupportedArea.objects.update_or_create(
                city=city,
                slug=slug,
                defaults={"name": name, "boundary": circle(lat, lng, 900), "coverage": cov, "coverage_note": note},
            )
        return out

    def _places(self, lisbon):
        cities = {c.slug: c for c in City.objects.all()}
        for i, (slug, name, sub, lat, lng, kind, popular) in enumerate(PLACES):
            city = cities.get(slug) if kind == PlaceKind.CITY else lisbon
            Place.objects.update_or_create(
                slug=slug,
                defaults={
                    "city": city,
                    "name": name,
                    "subtitle": sub,
                    "kind": kind,
                    "location": Point(lng, lat, srid=4326),
                    "is_popular": popular,
                    "popularity": 100 - i,
                },
            )

    def _sources(self):
        def mk(name, kind, attribution):
            return ParkingDataSource.objects.update_or_create(
                name=name,
                defaults={
                    "kind": SourceKind.DEVELOPMENT_FIXTURE,
                    "is_development_fixture": True,
                    "attribution": attribution,
                    "licence": "Development fixture — not for production",
                },
            )[0]

        return {
            "verified": mk(
                "Lisbon municipal parking data (sample)",
                SourceKind.OFFICIAL_OPEN_DATA,
                "Sample modelled on municipal open data. Not real.",
            ),
            "operator": mk("Operator tariff page (sample)", SourceKind.OPERATOR, "Sample operator tariff. Not real."),
            "community": mk(
                "Community-confirmed sign photo (sample)",
                SourceKind.COMMUNITY,
                "Sample community confirmation. Not real.",
            ),
        }

    def _permits(self, city):
        p1, _ = PermitType.objects.update_or_create(
            code="lisbon-resident-saldanha",
            defaults={
                "name": "Resident permit (Saldanha zone, sample)",
                "kind": PermitKind.RESIDENT,
                "city": city,
                "description": "Sample resident zone permit.",
            },
        )
        p2, _ = PermitType.objects.update_or_create(
            code="disabled-badge",
            defaults={
                "name": "Disabled parking badge",
                "kind": PermitKind.DISABLED_BADGE,
                "description": "European disabled parking card displayed in the vehicle.",
            },
        )
        return {p1.code: p1, p2.code: p2}

    # ------------------------------------------------------------------ parking areas & rules
    def _tariff(self, rate, car_park=False):
        name = f"{'Car park' if car_park else 'On-street'} €{rate}/h (sample)"
        return ParkingTariff.objects.update_or_create(
            name=name, defaults={"rate_per_hour": Decimal(rate), "billing_increment_minutes": 60 if car_park else 15}
        )[0]

    def _window(self, parent, days, start, end):
        kw = {"rule": parent} if isinstance(parent, ParkingRule) else {"restriction": parent}
        ParkingTimeWindow.objects.create(days=days, start_minute=start, end_minute=end, **kw)

    def _spots(self, city, areas, src, permits, now):
        counts = {"spots": 0, "rules": 0, "restrictions": 0, "closures": 0}
        today_local = now.astimezone(LISBON_TZ).date()
        for ref, area_slug, name, lat, lng, bearing, length, status, ago, case in SPOTS:
            is_park = bool(case.get("car_park") or case.get("badge"))
            point = Point(lng, lat, srid=4326)
            geometry = square(lat, lng, length) if is_park else segment(lat, lng, bearing, length)
            source = (
                src["operator"]
                if case.get("car_park")
                else src["community"]
                if status == "community"
                else src["verified"]
                if status == "verified"
                else None
            )
            evidence_status = {
                "verified": EvidenceStatus.OPERATOR_TARIFF if case.get("car_park") else EvidenceStatus.OFFICIAL_RECORD,
                "community": EvidenceStatus.SIGN_PHOTO,
                "unverified": EvidenceStatus.NONE,
            }[status]
            verified_at = now - timedelta(days=ago) if ago is not None else None
            partner = case.get("partner")
            area, _ = ParkingArea.objects.update_or_create(
                external_ref=f"dev-lisbon-{ref}",
                defaults={
                    "city": city,
                    "supported_area": areas[area_slug],
                    "name": name,
                    "address": f"{name}, Lisboa",
                    "kind": AreaKind.CAR_PARK
                    if case.get("car_park")
                    else AreaKind.BAY
                    if case.get("badge")
                    else AreaKind.ON_STREET,
                    "location": point,
                    "geometry": geometry,
                    "is_accessible": bool(case.get("accessible")),
                    "verification_status": status,
                    "evidence_status": evidence_status,
                    "verified_at": verified_at if status != VerificationStatus.UNVERIFIED else None,
                    "data_source": source,
                    "operator_name": "Sample operator" if case.get("car_park") else "",
                    "is_commercial_partner": bool(partner),
                    "partner_offer": partner[0] if partner else "",
                    "ev_charging_note": partner[1] if partner else "",
                    "is_active": True,
                },
            )
            counts["spots"] += 1
            # rebuild regulation data for this fixture area
            area.rules.all().delete()
            area.restrictions.all().delete()
            area.closures.all().delete()
            area.evidence.all().delete()
            # dev-fixture history is rebuilt too, so repeated seeding stays bounded
            ParkingDataRevision.objects.filter(area=area).delete()
            if source and verified_at:
                ParkingEvidence.objects.create(
                    area=area,
                    source=source,
                    captured_at=verified_at,
                    kind=EvidenceKind.OPERATOR_TARIFF
                    if case.get("car_park")
                    else EvidenceKind.SIGN_PHOTO
                    if status == "community"
                    else EvidenceKind.OFFICIAL_RECORD,
                    description="Development fixture evidence — not a real record.",
                )
            rule_src = source
            common = {"area": area, "source": rule_src, "verified_at": verified_at}

            def rule(kind, label, windows=(), _common=common, **kw):
                r = ParkingRule.objects.create(kind=kind, label=label, **_common, **kw)
                for days, s, e in windows:
                    self._window(r, days, s, e)
                counts["rules"] += 1
                return r

            def restriction(kind, label, windows=(), _common=common, **kw):
                r = ParkingRestriction.objects.create(kind=kind, label=label, **_common, **kw)
                for days, s, e in windows:
                    self._window(r, days, s, e)
                counts["restrictions"] += 1
                return r

            if case.get("free"):
                rule("free", "Free parking permitted outside listed restrictions")
            if "paid" in case:
                days, s, e, rate = case["paid"]
                rule(
                    "paid",
                    f"Paid parking €{rate}/h",
                    [(days, s, e)],
                    tariff=self._tariff(rate, bool(case.get("car_park"))),
                )
            if "future_paid" in case:
                in_days, days, s, e, rate = case["future_paid"]
                rule(
                    "paid",
                    f"New paid zone from {(today_local + timedelta(days=in_days)):%d %b} (sample)",
                    [(days, s, e)],
                    tariff=self._tariff(rate),
                    valid_from=today_local + timedelta(days=in_days),
                )
            if "max_stay" in case:
                minutes, days, s, e = case["max_stay"]
                rule("max_stay", f"Maximum stay {minutes // 60} hours", [(days, s, e)], max_stay_minutes=minutes)
            if "permit" in case:
                rule("permit_only", "Residents' permit holders only (sample zone)", permit_type=permits[case["permit"]])
            if case.get("badge"):
                rule("badge_only", "Disabled badge holders only", permit_type=permits["disabled-badge"])
            if "restrict" in case:
                kind, label, days, s, e = case["restrict"]
                restriction(kind, label, [(days, s, e)])
            if "event_restrict" in case:
                in_days, label = case["event_restrict"]
                d = today_local + timedelta(days=in_days)
                restriction("event", label, [(ALL, h(8), h(23))], valid_from=d, valid_until=d)
            if "closure" in case:
                start_off, end_off, reason = case["closure"]
                starts = datetime.combine(today_local + timedelta(days=start_off), time(0), tzinfo=LISBON_TZ)
                ends = datetime.combine(today_local + timedelta(days=end_off), time(23, 59), tzinfo=LISBON_TZ)
                TemporaryClosure.objects.create(
                    area=area,
                    reason=f"{reason} Until {ends:%d %b %Y}.",
                    starts_at=starts,
                    ends_at=ends,
                    source=rule_src,
                    verified_at=verified_at,
                )
                counts["closures"] += 1
        return counts

    # ------------------------------------------------------------------ help centre
    def _help(self):
        from apps.support.models import HelpArticle

        rows = [
            (
                "how-zpot-finds-parking",
                "parking",
                "How does Zpot find parking?",
                "Como é que o Zpot encontra estacionamento?",
                "We combine official parking rules (where available) with checks by drivers and scouts, then work out what applies "
                "for your arrival time and the whole of your stay. In this development build all rules are sample data.",
                "Combinamos regras oficiais (quando existem) com verificações de condutores e batedores, e calculamos o que se "
                "aplica à hora de chegada e a toda a estadia. Nesta versão de desenvolvimento todas as regras são dados de exemplo.",
            ),
            (
                "what-free-means",
                "parking",
                "What does “free” mean?",
                "O que significa “grátis”?",
                "No payment is required for your selected time and no restriction applies, according to the rules we have. It does "
                "not mean a space is empty — availability is not confirmed.",
                "Não é preciso pagar no horário escolhido e nenhuma restrição se aplica, segundo as regras que temos. Não significa "
                "que haja lugar livre — a disponibilidade não está confirmada.",
            ),
            (
                "labels",
                "parking",
                "What do the labels mean?",
                "O que significam as etiquetas?",
                "Verified: matched to an official source on the date shown. Community-confirmed: confirmed by drivers with photos. "
                "Rules unconfirmed: we don't know — check the signs.",
                "Verificado: confirmado numa fonte oficial na data indicada. Confirmado pela comunidade: confirmado por condutores "
                "com fotografias. Regras por confirmar: não sabemos — veja a sinalização.",
            ),
            (
                "community-reports",
                "reports",
                "How does community reporting work?",
                "Como funcionam os relatos da comunidade?",
                "Spots you share as you leave are shown for about 10 minutes and fade out. Rule corrections are reviewed by the data "
                "team before they change the map. Reports never override a verified legal restriction.",
                "Os lugares que partilha ao sair aparecem cerca de 10 minutos. As correções de regras são revistas pela equipa de "
                "dados antes de alterarem o mapa. Os relatos nunca se sobrepõem a uma restrição legal verificada.",
            ),
            (
                "reminders-fines",
                "sessions",
                "Do reminders protect me from fines?",
                "Os lembretes protegem-me de multas?",
                "No. Reminders help you plan, but street signs and enforcement officers decide. Always check the signs.",
                "Não. Os lembretes ajudam a planear, mas a sinalização e os agentes decidem. Confirme sempre a sinalização.",
            ),
            (
                "location",
                "privacy",
                "Why does Zpot want my location?",
                "Porque é que o Zpot quer a minha localização?",
                "To show nearby parking and walking times, only while you use the app. You can search a destination instead.",
                "Para mostrar estacionamento próximo e tempos a pé, apenas enquanto usa a app. Pode pesquisar um destino.",
            ),
            (
                "account",
                "account",
                "Do I need an account?",
                "Preciso de conta?",
                "No. You can search, compare and navigate as a guest. An account syncs saved places, sessions and your reports.",
                "Não. Pode pesquisar, comparar e navegar como convidado. Uma conta sincroniza locais, sessões e relatos.",
            ),
        ]
        for i, (slug, cat, ten, tpt, ben, bpt) in enumerate(rows):
            HelpArticle.objects.update_or_create(
                slug=slug, defaults=dict(category=cat, title_en=ten, title_pt=tpt, body_en=ben, body_pt=bpt, order=i)
            )

    def _scout_tasks(self):
        from apps.scouts.models import ScoutAssignment

        scout = get_user_model().objects.filter(email="scout@zpot.dev").first()
        for ref, reason in (
            ("dev-lisbon-s5", "Unverified street with frequent searches"),
            ("dev-lisbon-s7", "Conflicting community reports"),
        ):
            area = ParkingArea.objects.get(external_ref=ref)
            ScoutAssignment.objects.get_or_create(
                area=area, assigned_to=scout, report=None, defaults={"reason": reason}
            )
        # make admin a data reviewer too
        admin = get_user_model().objects.filter(email="admin@zpot.dev").first()
        if admin:
            UserRole.objects.get_or_create(user=admin, role=Role.DATA_REVIEWER)

    # ------------------------------------------------------------------ users
    def _users(self):
        import os

        User = get_user_model()
        shared = os.environ.get("ZPOT_SEED_PASSWORD") or None
        rows = [
            ("driver@zpot.dev", [Role.DRIVER], False),
            ("scout@zpot.dev", [Role.DRIVER, Role.SCOUT], False),
            ("admin@zpot.dev", [Role.ADMIN], True),
        ]
        self.stdout.write("Local development users (store these yourself; they are not saved anywhere):")
        for email, roles, superuser in rows:
            password = shared or secrets.token_urlsafe(12)
            user = User.objects.filter(email__iexact=email).first()
            if user is None:
                user = (User.objects.create_superuser if superuser else User.objects.create_user)(email, password)
            else:
                user.set_password(password)
                user.save(update_fields=["password"])
            user.is_email_verified = True
            user.email_verified_at = user.email_verified_at or timezone.now()
            user.save(update_fields=["is_email_verified", "email_verified_at"])
            UserProfile.objects.get_or_create(user=user, defaults={"display_name": email.split("@")[0].title()})
            UserPreference.objects.get_or_create(user=user)
            for r in roles:
                UserRole.objects.get_or_create(user=user, role=r)
            self.stdout.write(f"  {email:<20} {'(shared ZPOT_SEED_PASSWORD)' if shared else password}")
