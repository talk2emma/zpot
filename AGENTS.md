# AGENTS.md — working agreement for coding agents on Zpot

## Layout
- `Interactive prototype (play me)-html/` is the **read-only** design reference. Never edit it. Use `scripts/tools/capture-prototype-screens.cjs` and `scripts/tools/gen_migration_docs.py` to read it.
- `api/` is the Django 5.2 modular monolith (runs in Docker). `mobile/` is React Native 0.87 TypeScript (runs natively). `docs/` holds the specs and status. `scripts/` holds dev tooling.

## Rules that must not be broken
1. **Business logic lives on the server.** The mobile app renders API enums and never re-derives legality or cost.
2. **No record ≠ permission.** Missing or unverified rules return `unknown`, never free. Free ≠ vacant. Vacant ≠ legal.
3. **One ranking implementation.** Everything goes through `apps/parking/services/search.py::search_parking` and `ranking_key`. Commercial fields must never influence order (see `test_ranking_is_commercially_neutral`).
4. **Honest status.** Part 2 entry points route to `Part2Screen`. Never fake success. Update `docs/implementation-status.json` (regenerate with `python3 scripts/tools/gen_migration_docs.py`) and the completion report.
5. **No secrets** in the repo or the JS bundle. `scripts/gen-env.js` rejects `sk.*`. Tokens live in the Keychain only.
6. Seed data is a **development fixture**. Never present it as real Lisbon regulations.

## Commands
- Backend: `docker compose exec api pytest -q`, `docker compose exec api ruff check .`, `docker compose exec api python manage.py makemigrations --check`
- Mobile: `cd mobile && npx tsc --noEmit && npx jest`. Contract: `npm run test:contract` (API running).
- Everything: `./scripts/run-tests.sh`. Toolchain: `./scripts/doctor.sh`.

## Conventions
- Python: services and selectors hold the logic, views stay thin, errors go through `ZpotAPIError` (envelope `{error:{code,message,details,request_id}}`), Ruff at line length 120.
- TypeScript: strict mode. Screens call hooks, hooks call `services/api/*`, and presentation code never calls Axios. Every user-visible string goes in `src/i18n/locales/{en,pt-PT}.json` (keep key parity). Add `testID`s for anything tests or E2E touch.
- New endpoints need an OpenAPI response schema (`extend_schema`), tests, an entry in `docs/api/endpoints.md`, and a mobile Zod schema if the app consumes them.
