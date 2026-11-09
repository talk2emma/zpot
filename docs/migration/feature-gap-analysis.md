# Feature gap analysis — prototype vs BRD / TRD / business plan

Sources: the HTML prototype (58 screens, 10 overlays, 390 interactions), the BRD v1.0 working draft, the 2-page Technical Requirements PDF and the business plan. All three were read in full; see `source-requirements-extract.md`.

The prototype is the visual source of truth. Where it conflicts with confirmed business rules, the BRD wins (brief §1.1 priority order). **No prototype screen was deleted.** Every screen has a disposition in `screen-inventory.md`.

## 1. Present in the prototype and delivered in Part 1

| Capability | Requirement refs | Where |
|---|---|---|
| Guest-first use (no account needed to search, compare or navigate) | BRD-01/04, BR-001 | Onboarding → "Continue as guest"; all parking endpoints `AllowAny` |
| Language selection (EN / PT-PT), persisted, used throughout | BRD-03/74 | `LanguageScreen`, `src/i18n` (421 keys in each language) |
| Location primer with manual-destination fallback, plus denied / approximate / off / unavailable outcomes | BRD-02, UAT-06 | `LocationPermissionScreen`, `LocationOutcomeScreen` |
| Destination search with autocomplete, recent places, popular places and a message for unsupported cities | BRD-07 | `SearchScreen` → `/places/autocomplete/` |
| Arrival time, duration, max walk and free-only settings that change the actual query | BRD-07/22 | `PlanScreen`, `FiltersScreen` → `/parking/options/` params |
| Whole-stay rule evaluation in local time (DST, crossing midnight, max stay, closures, future rules) | BRD-14, J-02 | `regulations/services/engine.py` (24 unit tests) |
| Legality, price, eligibility, time limits and availability as independent fields | BRD-13 | `legal_status`, `pricing_status`, `eligibility_status`, `availability_status` |
| "No record ≠ permission": unverified or unrecorded streets are UNKNOWN, never free | BRD-12/19 | engine `no_permission_record`, `rules_not_confirmed` |
| Free-first ranking that ignores sponsorship; partner offers labelled separately | BRD-20/23 | `services/search.py::ranking_key`, test `test_ranking_is_commercially_neutral` |
| Evidence states not shown by colour alone (badge glyph + text) | BRD-21 | `ParkingStatusBadge`, layers legend |
| Source, last-verified date and confidence on every option | BRD-15/26 | `verified_at`, `data_source`, `confidence_label`; details "Source & verification" |
| No-free-result explanation plus labelled paid alternatives (never a fabricated vacancy) | BRD-25 | `ResultsPanel` no-free state |
| "Signage prevails" disclaimer at every decision point | BRD-16 | `CheckSignsNotice`, API `disclaimer` |
| External navigation hand-off with a recovery screen that keeps the search | BRD-27 | `NavigationPickerScreen` / `NavigationReturnScreen` |
| Accounts: register, verify, login, refresh, logout, reset password, profile, preferences, delete account (GDPR erasure) and consent ledger | BRD-45/46/48 | `accounts` app, 18 auth tests |
| Map layers and legend, zoom, recentre, "search this area", map/list switch, offline and map-failure states | prototype | `ExploreScreen`, `LayersSheet`, `MapControls` |

## 2. MVP (M1) features the prototype shows that are deferred to Part 2

Each of these has a working entry point in Part 1 that leads to an explicit "coming in the next build" screen. Each also has an app shell in the API.

| Feature | Refs | Part 1 state |
|---|---|---|
| Parking sessions, reminders and the notification permission prompt at session start | BRD-29/30/42 | Entries routed (`Part2:session`). Entities planned (`sessions` app). |
| Community reporting (leaving, found, occupied, incorrect, sign, closure), review, appeal, my reports | BRD-32/33/35/38/39 | Entries routed (`Part2:report`). `ParkingObservation` model and read endpoint exist. |
| Vacancy signals with decay, confirmations and conflicts | BRD-34/40 | `availability` model and selector exist. Writing and voting are Part 2. |
| Saved places (guest on-device save and account sync), rename, remove | BRD-41 | Recent destinations implemented. Saving is Part 2. |
| Notifications inbox and per-category preferences | BRD-43/44 | Contextual explanation implemented. Engine is Part 2. |
| In-app support and guidance-problem tickets with case IDs | BRD-51/52 | Not started (`support` app shell). |
| Data export request | BRD-48 | Not started (`privacy` app shell). Deletion is implemented. |
| Operator console: rule CRUD, evidence, audit, rollback | BRD-66 | Django admin covers CRUD and revisions (`ParkingDataRevision`). Two-person review is Part 2. |
| Funnel analytics events | BRD-69 | Not started. Consent (`analytics_opt_in`) is captured. |

## 3. Gaps the prototype does not cover (added or planned)

| Gap | Ref | Disposition |
|---|---|---|
| Public-holiday and event calendar in rule evaluation | BRD-14 | **Part 2.** The engine supports date-bounded rules (`valid_from`/`valid_until`), event restrictions and closures. There is no holiday calendar yet. |
| Rule recheck or expiry trigger and responsible verifier per rule | BRD-15 | Part 2. Today: `source`, `verified_at`, revisions. |
| Stale or conflicting rules downgrade to "uncertain" | BRD-15 | Partial: confidence drops to `medium` after 90 days. Automatic downgrade to UNKNOWN is Part 2. |
| Vehicle-specific attributes (dimensions, EV, loading) | BRD-17/18 | Partial: vehicle class filter on rules and restrictions. The rest is M3. |
| Real geocoding provider | TRD | Pluggable: local PostGIS gazetteer (default) or Nominatim adapter. A production provider decision is pending. |
| Mapbox as map provider | TRD | MapLibre Native is used because Mapbox needs credentials we don't have. The adapter contract is ready (`docs/development/maps.md`). |
| PT-PT as baseline language | BRD-74 | The app follows the device language and falls back to EN. Switching the default to PT-PT is a one-line change and a product decision. |
| Accuracy launch gate (98%) | BRD-63 | Out of scope for a development build. Fixtures are labelled as non-real. |

## 4. Experimental and post-MVP features shown in the prototype

| Feature | Refs | Disposition |
|---|---|---|
| Z-Trigger (Bluetooth / motion auto-detection), 5 screens | BRD-64/65 vs TRD/BP "core" | **Experimental**, behind the `z_trigger` flag (off). The BRD forbids making it a launch dependency. |
| Zpot Pro (paywall, trial, manage or cancel), commute planner, vehicles, insights | BRD-54/59, BP pricing | Post-MVP (M2). Not built. Prices in the BRD, BP and prototype disagree (€4.99/€2.99/€24.99). |
| Local ads and "Why this ad?" | BRD-55 | Post-MVP. Not shipped (ads must never appear while driving). |
| Partner reservation and EV referral | BRD-56 | Partial: partner offer and disclosure are shown read-only on details. Booking is post-MVP. |
| Scout tasks | BRD-61 | Part 2 (`scouts` app shell, `scout` role exists). |

## 5. Conflicts between sources

These were resolved using the brief's priority order.

* **`/spots/nearby` "top 5 nearest" (TRD) vs free-first ranking (BRD).** Kept as a compatibility adapter over the canonical ranking. It is marked `Deprecation`.
* **"White zones are free" (BP) vs "no record ≠ permission" (BRD).** The BRD wins. Areas without an explicit permission rule are UNKNOWN.
* **Vacancy expiry: 5–10 min (TRD), 3-min half-life (BP), "calibrate" (BRD).** The Part 2 decision stays configurable. The model stores `expires_at`.
* **Microservices (TRD) vs modular monolith (brief).** Modular Django monolith. See `docs/decisions/ADR-001`.
