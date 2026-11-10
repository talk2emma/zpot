# Final implementation report (Parts 1 + 2, with the code review)

* **Repository:** `zpot-mobile`.
* **Branches:** `main` holds Part 1 and Part 2 (`84979d6`, `586e8a2`, `2b8a332`, `f9337ea`). `code-review/2026-11` holds the review fixes on top.
* **Real figures only:** every number below comes from a command that was run. Gaps are marked as gaps.

## What exists

| Layer | Delivered |
|---|---|
| Backend (Django 5.2, PostGIS) | 16 apps. **117 API operations**, 117/117 with an OpenAPI response schema, backend tests and documentation (`docs/api/endpoint-audit.json`, `docs/FINAL_API_COMPLETENESS.md`). Celery worker and beat run reminders, expiry, purge, retention and data quality |
| Mobile (React Native 0.87, TS strict) | All **58 prototype screens** and 10 overlays mapped: **50 implemented, 6 partial, 2 blocked** (`docs/FINAL_SCREEN_COMPLETENESS.md`). EN and PT-PT, with 941 keys in each |
| Parts 1–2 scope | Search, rules, details, navigation hand-off, auth, sessions and reminders, reports, moderation and appeals, availability and verification, saved places and guest transfer, notifications inbox, help and support, privacy (consents, export, erasure), scouts, Z-Trigger (flagged), monetisation flags. Post-review additions: commute planner, vehicles and permits, savings and history, partner offer, subscription state |

### Partial or blocked, and why

* **Z-Trigger (5 screens):** the server workflow, consent, history, correction, confirmation and deletion work. **Native Bluetooth detection is not implemented**, and the feature is off by default.
* **Pro paywall:** an informational preview only. No purchases are possible and nothing is unlocked.
* **Pro welcome and Cancel subscription:** blocked. Both need App Store / Google Play billing, and building them without it would fake a purchase.
* **"Why this ad?" and the store sheet:** blocked, because ads and billing aren't shipped.

## Verification

| Check | Result |
|---|---|
| Backend `pytest` (real PostGIS) | **170 passed** |
| `ruff check` · `makemigrations --check` · OpenAPI `--validate` | Clean · no changes · 0 errors |
| `manage.py check --deploy` (production settings) | Only the HSTS subdomains/preload policy and cosmetic enum naming |
| Mobile `tsc --noEmit` · `eslint` | 0 errors · 0 errors (inline-style warnings only) |
| Mobile Jest | **75 passed** |
| Live API contract (`npm run test:contract`) | **11 passed** |
| iOS build (`xcodebuild`, iPhone 18 Pro sim, iOS 27.0) | Built and run |
| Android build (`gradlew assembleDebug`, Pixel_10_Pro, API 37) | Built and run (rebuilt after the deep-link fix) |
| Maestro E2E, iOS | **E2E-001 ✓ and E2E-002…012: 13/13 flows passed** in one uninterrupted run (`docs/code-review/e2e-ios-final.txt`) |
| Maestro E2E, Android | **E2E-001 ✓ and E2E-002…012: 13/13 flows passed** in one uninterrupted run (`docs/code-review/e2e-android-final.txt`) |

All E2E runs use the real local API and seed data (no mocks): the reminder is dispatched by Celery beat, the email link is read from Mailpit, and the API container is really stopped for the network-error journey.

## Defects found by running the app (fixed)

* Android `zpot://` deep links never opened the app.
* The keyboard covered footer buttons: iOS sheets, and all Android forms under edge-to-edge.
* A cross-user cache leak after sign-out.
* After email verification, Continue returned to the sign-up form.
* The inbox didn't refresh while open (a regression introduced and then caught during the review).

The full list is in `docs/code-review/REMEDIATION_LOG.md`.

## Honest limitations

* **No push provider:** reminders are delivered to the in-app inbox, and `push_status` records `not_configured`.
* **No payments, no entitlements:** the entitlement endpoint always returns Free.
* **No automatic face or number-plate redaction:** photos are re-encoded, which strips EXIF/GPS, and users are told to avoid capturing faces and plates.
* **No automated GDPR compliance:** the privacy rights tools exist, but lawful bases and retention periods await legal review.
* **Seed data is a development fixture**, not real Lisbon regulations.
* **Not measured:** device performance (startup, FPS, memory). Universal/App Links, a connection pooler and a statement timeout are not configured. See `docs/code-review/TECHNICAL_DEBT_REGISTER.md`.
* **Not production-ready by these checks alone:** deployment, monitoring, a push provider, billing (if Pro launches), legal review and production data are outstanding.
