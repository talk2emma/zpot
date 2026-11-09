# End-to-end tests (Maestro)

`part1-core-journey.yaml` runs the primary Part 1 journey against the **real** local API with seeded data. It uses no mocked responses.

```bash
brew install maestro          # or: curl -fsSL https://get.maestro.mobile.dev | bash
./scripts/start-api.sh --seed
./scripts/start-ios.sh         # or start-android.sh (installs the debug app)
maestro test mobile/e2e/part1-core-journey.yaml
```

Status (9 Nov 2026): the flow **passed** with Maestro 2.11.0 on the iOS 27 simulator (iPhone 18 Pro) and the Android emulator (Pixel_10_Pro, API 37), against the real seeded API. It includes the real hand-off to Apple Maps or Google Maps and the return to Zpot. Step screenshots are in `docs/screenshots/{ios,android}/`.

Tip: the first Android launch waits for Metro to build the bundle. Pre-warm it with `curl "localhost:8081/index.bundle?platform=android"`.

## Part 2 journeys (E2E-002 … E2E-012)

`mobile/e2e/part2/` holds one flow per journey from the brief. E2E-001 is `part1-core-journey.yaml`.

| ID | Flow | What it proves against the real API |
|---|---|---|
| E2E-002 | `e2e-002-location-denied.yaml` | Location denied → manual search → results → details |
| E2E-003 | `e2e-003-registration.yaml` | Register → verification link read from Mailpit → verified → sign out → sign in → sign out |
| E2E-004 | `e2e-004-session-lifecycle.yaml` | Start session (with reminder) → edit → end with cost → summary |
| E2E-005 | `e2e-005-community-report.yaml` | Details → report incorrect rule → nudge location → submit → My reports → history |
| E2E-006 | `e2e-006-verification.yaml` | Another driver's vacancy (created through the API) → "Yes" → API shows 1 confirmation |
| E2E-007 | `e2e-007-save-location.yaml` | Save → Saved tab → open → remove → empty |
| E2E-008 | `e2e-008-notification.yaml` | Reminder dispatched by **Celery beat** → inbox → opens the session → marked read |
| E2E-009 | `e2e-009-account-settings.yaml` | Preference saved → persists after leaving and after an app restart |
| E2E-010 | `e2e-010{a,b,c}-network.yaml` | Runner stops the API container → search error → API restarted → retry → results |
| E2E-011 | `e2e-011-no-free.yaml` | 5-min walk at Hub Criativo do Beato → no free parking → widen → results |
| E2E-012 | `e2e-012-rule-change.yaml` | 2 h free limit → extend stay → server re-evaluation → restriction warning |

Run with `scripts/e2e-part2.sh ios|android [glob]`. The runner re-seeds the dev users with a throwaway password generated for each run and passes it with `-e`. Before each flow it resets only the driver's active session, saved places and E2E-created reports. Results go to `docs/e2e-results/<platform>/summary.txt` (raw logs are git-ignored).

Notes:
* iOS keeps Keychain tokens across `clearState`, so the sign-in subflow signs out first if needed.
* E2E-003 needs Mailpit on `:8025`. E2E-008 waits up to 2 min for the beat-dispatched reminder.
* Push delivery is not part of any assertion: no push provider is configured, and the inbox is the source of truth.
