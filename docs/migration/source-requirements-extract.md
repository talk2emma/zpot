# Zpot — Source Requirements Extract

Extracted 2026-11-09 for feature gap analysis against the HTML prototype. Only content present in the three sources is recorded. "Not stated" means the source contains nothing for that area. Quotes are verbatim short phrases.

Release / priority legend (BRD's own): P0 = launch gate, P1 = near-term after pilot, P2 = future/experimental. M0 = discovery/data readiness, M1 = Lisbon MVP, M2 = Lisbon optimisation, M3 = commercial scale. MUST = mandatory, SHOULD = recommended, MAY = future option. BRD status: "PROPOSED — requirements and targets are not approved commitments."

---

## 1. Source access log

| Source | Accessed | Size | Method | Errors / notes |
|---|---|---|---|---|
| BRD (Google Doc `1dVG4zQ0v7NP7CKd3uBQO-gTObjw6WdGq2M8RbMDXs7g`) | Yes, in full | About 64 KB of text, 1,020 lines. It is a Google Doc, so it has no page numbers; citations use section numbers. | Google Drive MCP `read_file_content` | None. Title: "ZPOT BUSINESS REQUIREMENTS DOCUMENT (BRD)", v1.0, working draft, dated 09 Nov 2026. |
| Technical Requirements PDF (`/Users/emmanuelokoye/Downloads/Technical Requirements.pdf`) | Yes, in full | 2 pages | Read tool failed ("pdftoppm is not installed"), so the text layer was extracted with macOS PDFKit (Swift script) | The extracted text was complete. It is a short TRD, titled "Zpot Technical Requirements Document (v1.0)", and ends with chat-assistant boilerplate ("Final Business Plan Wrap-up ... Would you like me to help you draft the formal 'Investment Teaser'"). That boilerplate was ignored. |
| Business Plan PDF (`/Users/emmanuelokoye/Downloads/Business Plan For Zpot.pdf`) | Yes, in full | 16 pages | Same as above (PDFKit text extraction) | None. Financial tables were skimmed; only product, pricing and scope points were extracted. |

Text extractions were saved to the session scratchpad. They are not part of the repo.

---

## 2. BRD requirements

Citations: "§" = BRD section; BR-nnn / RULE-nn / NFR-nn / J-nn = the BRD's own IDs.

### 2.1 Onboarding
- BRD-01: Visitors MUST be able to use the app without an account: "open app → choose language → search destination → see rules and free options → navigate; optionally save only on consent/registration." M1. (§7 J-05)
- BRD-02: If location permission is denied, "manual destination entry continues to work". M1. (§7 J-05; UAT-06)
- BRD-03: Tourists need "language support and a trusted one-off journey with no mandatory account". (§3.1 SEG-02)
- No onboarding screens or tutorial flow are specified beyond these items.

### 2.2 Auth / accounts
- BRD-04: Core search and results MUST work "without mandatory registration". P0/M1. (BR-001 acceptance)
- BRD-05: The BRD allows both signed and anonymous use: "simple signed/anonymous user contribution paths". M1. (§4.1)
- BRD-06: Saving is "only on consent/registration". (§7 J-05)
- No auth methods (email, social, OTP and so on) are specified.

### 2.3 Search & discovery
- BRD-07: Users MUST be able to search by "address, place, map position or current location". They can set an intended arrival time, duration and maximum walking distance, and these settings must change the answer. P0/M1. (BR-001)
- BRD-08: M1 scope is a "Destination-first map and search; free/legal/timed-free parking discovery". (§4.1)
- BRD-09: Discovery covers viable streets and areas "in a user-defined radius". (CAP-01)
- BRD-10: Time-of-day planning is planned for M2. (§4.2)
- BRD-11: Journey J-01 runs: destination/time/duration → geocode → retrieve mapped lawful segments → evaluate the permitted interval and vehicle class → rank → show rule, walk time, confidence and freshness → choose → navigate externally → optionally start a session → confirm the outcome. M1. (§7 J-01)

### 2.4 Parking rules / legality
- BRD-12: A candidate MUST be a documented parking area or street segment, "rather than treating missing meter data as proof of lawful free parking". Unevidenced segments are shown as "unknown or are excluded". P0/M1. (BR-002)
- BRD-13: Legality, price, time limits, permitted vehicle/permit status and current availability MUST be independent properties. A residents-only free space is not usable for a non-permitted user, and an eligible free space with unknown occupancy is not marked "vacant". P0/M1. (BR-003)
- BRD-14: A time-aware rules engine MUST validate the entire proposed interval, including pricing and restriction transitions. It must flag any invalid portion and must not claim the whole session is free. It covers the local timezone, holidays, event exceptions and rule precedence. P0/M1. (BR-004, J-02)
- BRD-15: Each authoritative rule record MUST carry its source, observed/updated time, expiry or recheck trigger, and responsible verifier. Community input must not silently replace these rules. Stale or conflicted rules downgrade to "uncertain pending review". P0/M1. (BR-007)
- BRD-16: The app MUST state that "on-street signage and applicable laws prevail". The disclaimer and a correction affordance appear at relevant decisions, and nothing may imply a guarantee against fines. P0/M1. (BR-011)
- BRD-17: Vehicle-specific rules (dimensions, EV charging, loading, accessibility eligibility, permit class) SHOULD be configurable. Unknown conditions show as unknown. P2/M3. (BR-014)
- BRD-18: Professional/loading flow: "passenger bays are never silently treated as freight loading bays". M2/M3. (J-06)
- BRD-19: Unverified zones "must be marked unknown or excluded rather than shown as free". (§4.6)

### 2.5 Results & ranking
- BRD-20: Results MUST be ordered with feasible lawful free options first, then by trade-offs between distance, walk time, likely availability and predictable full-session cost. "paid placement MUST NOT secretly override this order." The comparison shows why an option is recommended and labels free, paid, conditional and sponsored options. P0/M1. (BR-005)
- BRD-21: The results screen MUST show these evidence states: "verified legal, conditionally legal, unknown, recently reported vacancy and restriction/closure". Icons and colour must never be the only distinction. P0/M1. (BR-006)
- BRD-22: Estimated walking distance and time to the destination MUST be shown and labelled, and the user can adjust the maximum. Changing the max walk changes the recommendations. P0/M1. (BR-008)
- BRD-23: Recommendations MUST be independent of advertiser bids, commission and subscription status, "unless the user explicitly selects a commercial comparison filter". P0/M1. (BR-034)
- BRD-24: Paid fallback (car parks, day rates, park-and-ride) SHOULD be offered with full pricing and eligibility, labelled as paid. P1/M2. (BR-012). M1 scope does include an "optional cheaper paid fallback". (§4.1)
- BRD-25: With no free option, the app shows a "no-result explanation and clearly labelled lower-cost alternatives; never fabricate a vacancy". M1. (J-01, UAT-04)

### 2.6 Details
- BRD-26: The detail view shows the legal rule, walk time, confidence and freshness (J-01), the end of the free period or maximum stay (J-02), and source freshness (UAT-01). The "Disclaimer and correction affordance" also appears here. (BR-011)
- No other detail-screen layout is specified.

### 2.7 Navigation
- BRD-27: Users MUST be able to launch external navigation and reopen Zpot if the spot is unusable. At least one handoff must work on each launch OS, and the recovery search must not require re-entering preferences. P0/M1. (BR-009)
- BRD-28: The app must provide "safe passive viewing/navigation handoff". (BR-025)

### 2.8 Sessions & reminders
- BRD-29: Parking sessions MUST be supported, with a user-specified start and end time, "voluntary location confirmation" and time-rule reminders. A reminder fires before expiry or a rule change, and "failure to deliver a push does not imply permission to remain parked". P0/M1. (BR-023)
- BRD-30: The free plan includes "basic session reminders". (§11.1)
- BRD-31: Contextual price-transition and temporary-restriction reminders SHOULD be configurable, and users can opt out. Reminders must distinguish confirmed rule changes from unconfirmed community alerts. P1/M2. (BR-027)

### 2.9 Community reporting & trust
- BRD-32: Users MUST be able to report a departure, a found vacancy, an obstruction, a restriction change or incorrect information, with location and timestamp. A report is labelled unverified until checked, and the user can see an acknowledgement and the report's status. P0/M1. (BR-015)
- BRD-33: Reports MUST be screened for duplicates, impossible coordinates, abuse and spam before they affect recommendations. Moderation is auditable and appeals are supported. P0/M1. (BR-016)
- BRD-34: Vacancy signals MUST decay over time and show their reported time. "An expired departure report cannot persist as a currently vacant bay." The initial decay values must be calibrated. P0/M1. (BR-017)
- BRD-35: Conflicting reports MUST create a reviewable conflict and "MUST NOT automatically overrule a reliable legal restriction". P0/M1. (BR-018)
- BRD-36: A calibrated availability model MAY combine crowdsourced data, historical data and sensor feeds, with uncertainty shown. P1/M2. (BR-019). Predictive vacancy is M2. (§4.2)
- BRD-37: Reputation SHOULD reward validated usefulness, not volume, and must be reversible after abuse. P1/M2. (BR-021). The "richer contributor trust score" is M2. (§4.2)
- BRD-38: Users MUST be able to flag an erroneous rule or closure "in two straightforward interactions after locating the item". The flag creates a tracked case. P0/M1. (BR-022)
- BRD-39: Incorrect-signage flow (J-04): the user flags with an optional photo → personal information is stripped → review queue → a scout checks → a versioned, audited publish. If there is an imminent illegal-parking risk, the advice is suppressed or downgraded. M1.
- BRD-40: "Recently reported" vacancy is shown only "for a short interval → expiry removes signal". Conflicts and stale signals give the unknown state, not "available". M1 (reports) / M2 (predictions). (J-03)

### 2.10 Saved places
- BRD-41: Saved destinations, routine commute presets and preferred trade-offs SHOULD be available, and history must be erasable. P1/M2. (BR-013). "saved commute routines" is M2. (§4.2)
- BRD-42: M1 scope includes "saved/active session reminders". (§4.1)

### 2.11 Notifications
- BRD-43: Essential legal restrictions and safety alerts MUST be available to free users. A non-paying user sees the same critical notices as a subscriber. P0/M1. (BR-024, RULE-09)
- BRD-44: Notification choices are part of the stored user preferences. (§9.1). See also BRD-29 and BRD-31.

### 2.12 Profile / settings / privacy / GDPR
- BRD-45: Location, authentication and device data MUST follow purpose limitation, minimisation and retention rules. Deletion and access workflows must work. P0/M1. (BR-041)
- BRD-46: "Consent and privacy controls" are in M1 scope. (§4.1)
- BRD-47: The app must not "collect passive location traces or resell fine-grained individual movement data by default". (SP-06)
- BRD-48: Consent records, privacy notice, retention schedule and export/deletion requests. (NFR-04; UAT-10)
- BRD-49: Geolocation should use the "minimum raw precision/time needed". (§9.4)
- BRD-50: User content with personal data, number plates or faces is "minimised/filtered where possible". (RULE-13)

### 2.13 Support
- BRD-51: The app MUST offer in-app ways to get help, contest a mapping decision and request privacy assistance. Each case gets an ID and category. P0/M1. (BR-039)
- BRD-52: "customer support/corrections" is in M1 scope. (§4.1)

### 2.14 Monetisation (Pro / ads / partners)
- BRD-53: The consumer core MUST be free: discovery, rule interpretation, essential alerts, navigation and correction reporting, with "no forced payment or engagement ads". P0/M1. (BR-028; BR-010: no payment credentials, subscription or ad viewing required)
- BRD-54: Zpot Pro SHOULD sell only optional convenience: advanced planning, recurring routes, historical insights and ad-free use. There is no exclusive access to free locations or safety alerts. Users can subscribe, cancel and keep the basic product. P1/M2. (BR-029, J-07, UAT-11)
- BRD-55: Local ads MAY appear in walking-route or post-parking contexts. They must be "unmistakably marked as sponsored", limited in volume and never shown while driving. P1/M2. (BR-030, J-08). There must be no "app-driving-screen ads". (§11.3)
- BRD-56: Parking and EV referral fees MAY come from disclosed partners. Fees and pricing must be shown, and "missing inventory does not imply available space". P1/M2. (BR-031, §11.4)
- BRD-57: B2B rules API SHOULD license only well-supported fields. P2/M3. (BR-032). Aggregated parking-pressure data MAY be sold with re-identification protection. P2/M3. (BR-033)
- BRD-58: Each revenue stream MUST be tracked financially. P0/M1. (BR-035)
- BRD-59: The Pro price of €4.99/month is "a proposed test price, not an approved market price". (§11.2)

### 2.15 Scouts / data ops
- BRD-60: Canonical sources MUST be updated on a risk-based verification cadence, with urgent handling for temporary prohibitions. "no universal 24-hour accuracy guarantee is promised". P0/M1. (BR-037)
- BRD-61: SEG-05 (resident/community scout) needs a quick reporting/verification workflow, reputation and acknowledgement. (§3.1)
- BRD-62: Data source hierarchy: authoritative regulations > field verification > partner data > community reports, which are "short-lived observations". (§9.2)
- BRD-63: Proposed launch gate of "at least 98% accuracy" in sampled legal classifications, with "zero tolerance" for known high-severity illegal recommendations. (§9.3, Gate 1)

### 2.16 Z-Trigger / auto detection
- BRD-64: Passive Bluetooth/motion parking inference MAY be tested "only as an opt-in experiment and MUST NOT be a launch dependency". P2/M3. (BR-020)
- BRD-65: "mandatory Bluetooth motion inference" is excluded from M1. (§4.4). "unavailable Bluetooth permissions must never block the main app". (NFR-11)

### 2.17 Admin
- BRD-66: An operator console MUST support rule creation, edits, evidence attachments, approvals, deprecation, audit history and rollback, with two-person review for high-risk changes. P0/M0–M1. (BR-036)
- BRD-67: There MUST be a severity rubric and incident triage, including content suspension. P0/M1. (BR-038)
- BRD-68: Operational access MUST be role-based and audited, with logged exports. P0/M1. (BR-042)
- BRD-69: Critical journeys MUST emit privacy-appropriate funnel events: searches, result displays, navigation starts, parking confirmations, corrections and repeat sessions. P0/M1. (BR-043)
- BRD-70: Release go/no-go is evidence-based (BR-045). Each new city needs a readiness checklist. (BR-046, P2/M3)

### 2.18 Non-functional
- BRD-71 Performance: Destination-search latency must be measured on realistic Lisbon handset and network profiles. The threshold is to be agreed during MVP benchmarking, so no number is set. (NFR-02)
- BRD-72 Reliability: A pilot availability SLO with on-call ownership, and "no blanket 'zero downtime' claim". (NFR-01)
- BRD-73 Accessibility: Core journeys must work with screen readers. The app needs accessible labels, contrast, "non-colour state labels" and keyboard-equivalent interactions. P0/M1. (BR-026, NFR-05). It must discourage reporting while moving and include a non-driving mode. (BR-025, SP-08)
- BRD-74 Localisation: "PT-PT baseline with EN candidate for Lisbon launch". Local date, time and currency conventions apply. (NFR-06, BR-026)
- BRD-75 Security: Encryption in transit and at rest, secrets management, access controls, abuse mitigation and vulnerability checks. (NFR-03)
- BRD-76 Offline: Cache modes "may be introduced where justified, but stale offline rules must visibly carry time/validity warnings". (NFR-10)
- BRD-77 Observability: Trace errors in geocoding, pricing rules, pipelines, alert delivery and moderation "without unnecessarily logging precise user paths". (NFR-07)
- BRD-78 Scalability / city config: Independent per-city configuration (NFR-08, SP-09). Graceful "degradation from predictions to verified static rules". (NFR-12)
- BRD-79 Compatibility: Agreed iOS and Android versions with capability fallbacks. (NFR-11)
- BRD-80 Auditability: Changes to rules, trust scores, entitlements, placement policy and B2B exports must be accountable. (NFR-09)

### 2.19 BRD data entities (§9.1, logical, not a schema)
ParkingArea/StreetSegment; RuleSet/Restriction; PricingSchedule; EvidenceRecord; ParkingObservation; UserPreference/Session; Contributor/TrustRecord; OperationalCase; Partner/CommercialContract; Usage/OutcomeEvent.

### 2.20 BRD M1 exclusions (§4.4)
These are out of M1 scope: guaranteed live vacant bays; direct enforcement officer alerts; sale of individual location trails; "fine insurance"; full parking payment processing; a private-space booking marketplace; 100% Greater Lisbon coverage; mandatory Bluetooth motion inference; inferring legality only from the absence of paid-zone data; unlicensed third-party data extraction.

---

## 3. TRD requirements (Technical Requirements PDF, 2 pages)

- TRD-01: The system is a "Spatiotemporal Detection Engine" that tracks the transition from "Driving" to "Parked". (p1 §1)
- TRD-02: Frontend: cross-platform "(Flutter/React Native) with high-frequency background execution permissions". (p1 §1)
- TRD-03: Backend: "Node.js/Python microservices". (p1 §1)
- TRD-04: Database: "PostgreSQL + PostGIS". Use `ST_DWithin` "to find spots within 200m of a user". (p1 §1)
- TRD-05: Mapping: "Mapbox SDK (preferred over Google for superior custom styling of 'White Zones' and offline vector tile support)". (p1 §1)
- TRD-06: Z-Trigger, for detecting parking "without the user opening their phone". (p1 §2)
  - State A (Driving): connected to a known Bluetooth MAC (car head unit) and GPS speed > 15 km/h.
  - Trigger: Bluetooth disconnect ("Ignition off").
  - State B (Verification): the accelerometer detects "Step Activity", and "GPS Dwell" confirms a Parking Event if the phone stays within a 20 m radius for more than 3 minutes after the disconnect.
  - Action: silent ping `{lat, long, timestamp, confidence_score}`.
- TRD-07: There are three map data layers (p1 §3):
  - "Static Polygons": hand-mapped "White Zones" (GeoJSON).
  - "Ephemeral Points": "Spot Just Vacated" markers, "TTL: 5-10 minutes".
  - "Risk Overlays": "High Enforcement" areas built from community heatmaps.
- TRD-08: Report weighting: `Score = (User_Karma × 0.6) + (Proximity × 0.2) + (Recency × 0.2)`. (p1 §4)
- TRD-09: Conflict rule: a high-karma user marking a spot "Taken" "overrides three 'Free' reports from low-karma users". (p1 §4)
- TRD-10: `POST /events/park` carries an "anonymized device ID and precise coordinates". (p2 §5)
- TRD-11: `GET /spots/nearby` queries by the "user's destination, returning the top 5 nearest 'White Zones'". (p2 §5)
- TRD-12: `POST /verify` is a "lightweight 'thumbs up/down' API" for confirming that a spot is still available while walking past it. (p2 §5)
- TRD-13: Battery: use "Significant Location Change and Geofencing APIs to avoid constant GPS polling". (p2 §6)
- TRD-14: OS: "iOS SceneDelegate and Android WorkManager must be configured to ensure the Bluetooth listener survives app termination". (p2 §6)
- TRD-15: Privacy: "No raw GPS traces stored. Only 'Snapshots' of start/end points are saved to ensure GDPR compliance." (p2 §6)

### 3.1 API endpoints, verbatim
The TRD gives no `/api/v1/` prefix and no versioning.
- `POST /events/park`
- `GET /spots/nearby`
- `POST /verify`

### 3.2 Data models / entities named
No formal models are defined. The TRD names these concepts:
- "Parking Event" `{lat, long, timestamp, confidence_score}`
- "White Zones" (GeoJSON static polygons)
- "Spot Just Vacated" ephemeral points (TTL 5–10 min)
- "High Enforcement" risk overlay polygons
- User Karma
- report Score
- anonymized device ID
- start/end point "Snapshots"

### 3.3 Tech-stack choices
- Flutter or React Native
- Node.js/Python microservices
- PostgreSQL + PostGIS (`ST_DWithin`)
- Mapbox SDK
- GeoJSON
- iOS SceneDelegate
- Android WorkManager
- Significant Location Change API
- Geofencing APIs

### 3.4 Third-party services
- Mapbox. Google is mentioned only as the non-preferred alternative.
- No other third-party services are named.

### 3.5 NFRs named
- Battery optimisation
- Background survival after app termination
- GDPR: no raw GPS traces
- "high-speed spatial queries"
- Offline vector tiles, via the Mapbox rationale

---

## 4. Business plan product points (16 pages)

- BP-01: Vision: "community-driven navigation platform" mapping "every unregulated free parking space (White Zones)" with "real-time vacancy data". The positioning is "Anti-Payment". (p1)
- BP-02: Core map content (p1):
  - "White Zones" are "Verified unregulated streets where parking is 100% free".
  - "Time-Sensitive Spots" become free "after hours or on weekends".
  - "Real-Time Vacancy" uses "Waze-style" reports of vacated spots.
  - The "Anti-Fine Shield" gives alerts for street cleaning, events and active enforcement.
- BP-03: Launch market is Lisbon. The initial target is "250,000 daily commuters entering Lisbon city center". (p1)
- BP-04: Expansion plan: Madrid, Milan and London (p2); then Porto, Braga and Madrid in 2027 (p2); then Porto and Cascais in months 9–12 (p12). The "Zpot Framework" is meant to be "city-agnostic". (p2)
- BP-05: Roadmap dates: Q1 2026 "White Zone" mapping of Greater Lisbon; Q2 2026 Beta to 1,000 "Scout" users; Q3 2026 public Lisbon launch. (p2)
- BP-06: Rule decoding into a simple "Free Now" or "Paid Now" interface. (p4 §2.2C)
- BP-07: EMEL zone model, with the Zpot strategy for each zone (p5 §3.2):

  | Zone | Price | Max stay | Zpot strategy |
  |---|---|---|---|
  | Red | €1.60+/h | 2h | "nearby White Zones (10-min walk)" |
  | Yellow | €1.20/h | 4h | "Time-Sensitive free windows" |
  | Green | €0.80/h | no limit | "unregulated buffer streets" |
  | Brown | €2.00+/h | 2h | "Dirt Lots (Terrenos Batidos)" |
  | White | €0.00 | unlimited | the "Core Zpot Product" |

- BP-08: Personas (p5–6):
  - Daily Commuter: will walk 10 minutes to save €200/month.
  - Gig Worker: parks for 5–10 minutes several times a day, and fines are their main threat.
  - Nightlife/Weekend Visitor: wants to know where parking is free "after 19:00 or on Saturdays & Sundays".
- BP-09: The app is iOS and Android, built for "one-hand, eyes-on-the-road" use, around a "Dynamic Layered Map" showing White Zones, timed-free spots and real-time vacancies. (p7 §4.1)
- BP-10: Data tiers (p7 §4.2):
  - Tier 1 is the static, scout-verified layer combined with municipal Open Data.
  - Tier 2 is single-tap "Found a Spot" / "Leaving a Spot" reports, with sign photos decoded by OCR.
  - Tier 3 is a passive Bluetooth/accelerometer trigger.
- BP-11: Trust (p7 §4.3):
  - The algorithm is a "Bayesian Trust Algorithm".
  - "Verified Scouts" carry "5x the weight of new users".
  - In high-demand zones, a "Spot Open" report has a "3-minute half-life" and the icon fades.
  - Free/taken conflicts are resolved with historical occupancy and the reporter's proximity.
- BP-12: Smart Navigation hands off to "Google Maps/Apple Maps/Waze". (p7 §4.4)
- BP-13: "Z-Alerts" are push notifications on entering a high-enforcement area, e.g. "Resident parking only on this block after 19:00". (p8)
- BP-14: "Off-Line Mode" caches the White Zone maps, e.g. for Alfama. (p8)
- BP-15: Stack: Flutter or React Native; "Serverless Architecture (AWS/Google Cloud)"; PostGIS. (p8 §4.5)
- BP-16: Product roadmap (p8 §4.6):
  - Alpha: manual mapping.
  - Beta: reporting UI plus "Karma".
  - V1.0: Bluetooth passive detection.
  - V2.0: Android Auto and Apple CarPlay.
- BP-17: Gamification (p9 §5.4):
  - Z-Points for verifying a spot, reporting an "arrumador" or flagging a new EMEL sign.
  - A leaderboard, e.g. "Marvila's Top Scout", whose top users get early access or Pro.
  - Referrals give both users 1 month of Pro.
- BP-18: Operations (p10 §6.1):
  - A "24-hour Verification Cycle" with a daily AI audit of municipal open data.
  - A "Check-in Quest" with bonus Z-Points if a spot has had no report for 48 hours.
  - Users can flag "Incorrect Info". "Two flags from high-trust users automatically hide a spot" until a Scout verifies it.
- BP-19: Scouts use an "Admin Version" of the app with 360° photos and high-resolution coordinates. Neighbourhood pods. 50 university ambassadors as moderators. (p11 §6.2)
- BP-20: Moderation and support (p11 §6.3):
  - AI photo filtering removes plates and faces.
  - There is an in-app "Help" desk for users who were wrongly guided.
  - "does not take legal liability for fines" (in the Terms of Service).
- BP-21: Monetisation (p2, p14 §8.2):
  - Hyper-Local "Path" Ads: €5–€15 CPM.
  - Zpot Pro: €4.99/month for "Fine-Shield" alerts, spot "sniping" and an ad-free experience. Page 2 adds "fine-protection insurance".
  - B2B data licensing: €500–€2,000 per month per partner.
  - EV partnership: 5–10% commission on charging.
- BP-22: Assumed 3% conversion to Pro. Year 1 targets: 50,000 downloads and 15,000 MAU (p10), but 50,000 total active users (p15).
- BP-23: Partnerships: local businesses (p12), EV chargers (p14), B2B logistics, urban planners and real estate (p2, p14).
- BP-24: Fallback for municipal risk: "Time-Window Management", showing when paid zones become free (nights and weekends). (p15)

---

## 5. Explicit business rules

### Legality
- BRD RULE-01: A segment can be recommended as lawful only with authoritative rules plus field evidence for the user's time, duration and eligibility. "'No paid meter recorded' is insufficient."
- BRD RULE-05: Temporary closures, events, roadworks, street cleaning and emergency restrictions override normal prices when verified.
- BRD RULE-10: Ineligible vehicle or permit classes get no recommendation based on a generic profile.
- BRD RULE-11: High-risk or disputed rules need verifiable approval before they can be reinstated.
- BRD SP-03: "Legality precedes affordability." Free, cheap and vacant are distinct.

### Free vs paid
- BRD RULE-02: "Free" means the price within the selected session. It does not imply vacancy, permission or an unlimited stay.
- BRD RULE-09: Critical compliance alerts are never gated behind a purchase.
- BRD BR-010 / BR-028 / §11.1: The free core stays usable without payment, a subscription or ads.

### Ranking
- BRD SP-01 / BR-005: Free-first ranking.
- BRD RULE-08: The ranking must explain the trade-offs: walking distance, legal stay, total cost, confidence and availability uncertainty.
- BRD RULE-12: If availability is unknown, the app may suggest searching a verified legal street but "must not promise an empty spot".
- TRD: `/spots/nearby` returns the "top 5 nearest" White Zones (nearest by distance).

### Sponsorship neutrality
- BRD RULE-07: Commercial interest must be disclosed, and paid placement must not change the organic free-first order.
- BRD BR-034: Ranking is independent of advertiser bids, commission and subscription unless the user picks a commercial comparison filter.
- BRD SP-10: Commercial content may not suppress safety information.
- BRD §11.6: "prevent sales teams from marking data verified".

### Data freshness and provenance
- BRD RULE-03: "Verified" requires an attributable source and a last-verified time. Unadjudicated crowd claims are "reported", not "official".
- BRD BR-007: Stale or conflicted rules downgrade to uncertain.
- BRD BR-037: Risk-based verification cadence, with no 24-hour guarantee.
- BP §6.1: A 24-hour verification cycle, and a quest after 48 hours with no report.

### Report expiry and conflicts
- BRD RULE-06: Reports and passive signals have separate expiry schedules and cannot create durable legal rules.
- BRD BR-017: Vacancy signals decay. The decay values are to be calibrated, and the BRD gives no number.
- TRD: "Spot Just Vacated" TTL is 5–10 minutes.
- BP: "Spot Open" has a 3-minute half-life in high-demand zones.
- BRD RULE-04 / BR-018: Conflicts default to suppression or uncertainty. Community confidence cannot override a prohibition.
- TRD: Karma-weighted score. One high-karma "Taken" overrides three low-karma "Free" reports.
- BP: Two high-trust "Incorrect Info" flags auto-hide a spot. Scouts carry 5× weight.

### Privacy and content
- BRD RULE-13: Plates and faces in user content are minimised or filtered.
- BRD RULE-14: Tracking, behavioural ads and passive detection each need separate lawful analysis. A blanket "anonymised" claim is not enough.
- TRD: Store no raw GPS traces, only start/end snapshots.

### Claims
- BRD RULE-16: Savings and emissions claims need a stated baseline, with no guaranteed outcomes.
- BRD §1.4: The plan's €1,000+ savings, under-5-minute search and 80% accuracy figures are "unvalidated hypotheses".

### Coverage
- BRD RULE-15: An area is "fully supported" only when it has an operational owner and source rights.
- BRD §4.6: Unverified zones are shown as unknown or excluded, never as free.

---

## 6. Conflicts or ambiguities between sources

1. **Passive Z-Trigger.** The TRD (§2) and the BP (Tier 3, V1.0) treat Bluetooth-disconnect detection as core ("secret sauce", "80% accuracy" claim). The BRD makes it P2/M3, "opt-in experiment", "MUST NOT be a launch dependency", and excludes it from M1.
2. **Background permissions.** The TRD requires "high-frequency background execution permissions" and a Bluetooth listener that "survives app termination". The BRD (NFR-11, UAT-06) says denied or missing Bluetooth or background permissions must never block the core app.
3. **What counts as "free".** The BP and TRD say "White Zones" means "100% free" unregulated streets. The BRD (Appendix A) says "White Zones" become "Zpot classifications validated against actual local law". The BRD also forbids inferring legality from missing paid-zone data, whereas the BP's "unregulated" framing implies exactly that inference.
4. **Ranking.** The TRD `GET /spots/nearby` returns the "top 5 nearest" White Zones, i.e. pure distance and a fixed count of 5. The BRD requires free-first ranking with trade-offs (walk, legal stay, cost, confidence), explanations, and time, duration and eligibility evaluation. The TRD endpoint has no time, duration or vehicle parameters.
5. **Search radius.** The TRD gives a 200 m `ST_DWithin` example. The BRD says the radius is "user-defined" and set by max walk distance. The BP Red-zone strategy targets a "10-min walk".
6. **Vacancy decay.** TRD: TTL 5–10 minutes. BP: 3-minute half-life (high-demand zones). BRD: decay values "must be calibrated", with no number given.
7. **Conflict resolution.** TRD: one high-karma "Taken" overrides three low-karma "Free" reports, a fixed formula with weights 0.6/0.2/0.2. BP: Bayesian; Scouts get 5×; historical trends plus proximity. BRD: conflicts create a reviewable case; community data never overrides legal restrictions; weighting is not specified.
8. **Auto-hide on flags.** BP: two high-trust flags auto-hide a spot. BRD: a flag creates a case, and imminent-risk items are suppressed or downgraded pending verification. The BRD sets no automatic threshold.
9. **Enforcement alerts.** BP ("Anti-Fine Shield", "active enforcement" alerts) and TRD ("High Enforcement" risk overlays) both include them. The BRD excludes "direct enforcement officer alerts" from M1 and rejects "enforcement evasion" (SP-07).
10. **Pro contents.** BP: Pro includes "Fine-Shield" alerts, "sniping" and "fine-protection insurance". BRD: safety and compliance alerts must be free; "sniper" is postponed until prediction works; insurance is deferred or excluded. The €4.99 price is a "test price" only.
11. **Freshness promise.** BP: a "24-hour Verification Cycle". BRD: "no universal 24-hour accuracy guarantee".
12. **Backend architecture.** TRD: Node.js/Python microservices. BP: serverless on AWS/Google Cloud, "containerized", "copy-paste" a city in under 48 hours. BRD NFR-08 rejects the 48-hour claim. None of the sources names Django; the project's Django choice is consistent only with the TRD's "Python".
13. **Map provider.** TRD: Mapbox is preferred over Google. The BP's navigation handoff names Google Maps, Apple Maps and Waze. The BRD names no provider ("Mapping/routing provider rights and costs" is listed as a dependency).
14. **Offline mode.** BP: cached White Zone maps as a feature. TRD: Mapbox for offline vector tiles. BRD: offline only "where justified", and stale rules must carry validity warnings.
15. **Privacy approach.** TRD: an "anonymized device ID and precise coordinates" plus start/end snapshots. BP: "all data is anonymized", and B2B "high-resolution urban flow data". BRD: a blanket "anonymised" claim is insufficient; B2B is aggregated only, with no individual trails; geolocation may be personal data.
16. **API versioning.** TRD paths have no `/api/v1/` prefix. Any versioned path in this project comes from the project, not from the sources.
17. **Marketing tactics.** BP: the "Fake Ticket" campaign and an "Anti-EMEL" voice. BRD Appendix A replaces "anti-municipality adversarial marketing and fake parking tickets".
18. **Year-1 users.** BP p10: 15,000 MAU. BP p15: 50,000 active users. The BRD §11.8 flags the inconsistency.
19. **Accounts.** None of the sources defines an authentication method. The BRD requires guest use. The TRD uses an anonymized device ID. The BP implies user karma and leaderboards, which need persistent identity.
20. **Timeline.** BP: Q1–Q3 2026 milestones. The BRD is dated 09 Nov 2026 and is still at "PROPOSED" status with Gate 0/M0 pending, so the BP dates appear superseded.
