# Working in Antigravity (editor) with Android Studio and Xcode

Antigravity is where you edit code. Android Studio and Xcode are only used to build, run and debug the native shells. All three work on the same checkout, so there is nothing to sync.

## Daily loop

1. Open the repo root `zpot-mobile/` in Antigravity. Agents should read `AGENTS.md` first.
2. Backend: `./scripts/start-api.sh` (Docker: api, worker, beat, db, redis, mailpit). Add `--seed` the first time.
3. Metro: `cd mobile && npm start` in an Antigravity terminal and keep it running.
4. Run the app:
   * Android: `./scripts/start-android.sh`, or open `mobile/android` in Android Studio and press Run. See [android-studio.md](android-studio.md).
   * iOS: `./scripts/start-ios.sh`, or open `mobile/ios/Zpot.xcworkspace` in Xcode and press Run. See [xcode.md](xcode.md).
5. Edit TypeScript in Antigravity, save, and Fast Refresh updates the running app. Press R twice (Android) or ⌘R (iOS simulator) for a full reload.
6. Edit Python in Antigravity. The API container autoreloads (bind mount). Celery worker and beat need `docker compose restart worker beat`.

## When you need a native rebuild

Rebuild (and run `scripts/tools/pod-install.sh` on iOS) after:
* adding or upgrading a package with native code (for example `react-native-image-picker`, `react-native-permissions`)
* editing `Info.plist`, `AndroidManifest.xml`, Gradle files, the `Podfile` or app icons

Pure TypeScript, i18n JSON and asset-free changes only need Metro.

## Checks before committing

```bash
./scripts/run-tests.sh            # API pytest + ruff + migrations check, mobile tsc + eslint + jest, contract tests
cd mobile && npm run api:types     # after any API schema change (regenerates src/types/openapi.d.ts)
python3 scripts/tools/gen_migration_docs.py   # screen/interaction status → docs/implementation-status.json
python3 scripts/tools/api_audit.py /tmp/zpot-openapi.json  # endpoint checklist (see the script header)
```

E2E (real API, no mocks): `scripts/e2e-part2.sh ios|android`, plus `mobile/e2e/part1-core-journey.yaml`. See `mobile/e2e/README.md`.

## Guardrails for agents

* Never edit `Interactive prototype (play me)-html/`.
* Business rules live on the server. The app renders enums.
* No secrets in the repo or the bundle. `scripts/gen-env.js` rejects secret-looking keys.
* Report status honestly in `docs/implementation-status.json` and the final reports.
