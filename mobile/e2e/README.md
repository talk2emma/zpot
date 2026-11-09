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
