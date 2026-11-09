# End-to-end tests (Maestro)

`part1-core-journey.yaml` runs the primary Part 1 journey against the **real** local API with seeded data. It uses no mocked responses.

```bash
brew install maestro          # or: curl -fsSL https://get.maestro.mobile.dev | bash
./scripts/start-api.sh --seed
./scripts/start-ios.sh         # or start-android.sh (installs the debug app)
maestro test mobile/e2e/part1-core-journey.yaml
```

Status: the flow is authored against the RN `testID`s. It has **not** been executed in this environment because the Maestro CLI isn't installed (see `docs/PART_1_COMPLETION_REPORT.md`). The same journey is covered at component level in `__tests__/parking.test.tsx` and at the API level by the contract suite.
