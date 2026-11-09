#!/usr/bin/env bash
# Runs every automated suite and reports honestly which ones ran.
set -uo pipefail
source "$(dirname "$0")/lib.sh"
FAIL=0
head1 "Backend: lint + tests (PostGIS in Docker)"
if docker info >/dev/null 2>&1 && (cd "$ROOT" && docker compose ps --status running api | grep -q api); then
  (cd "$ROOT" && docker compose exec -T api sh -c "ruff check . && python manage.py makemigrations --check --dry-run && pytest -q") \
    && ok "backend passed" || { fail "backend failed"; FAIL=1; }
else warn "SKIPPED backend — API container not running (scripts/start-api.sh)"; FAIL=1; fi

head1 "Mobile: typecheck + lint + unit/component tests"
(cd "$MOBILE" && npx tsc --noEmit && npx eslint src --quiet && npx jest --silent) && ok "mobile passed" || { fail "mobile failed"; FAIL=1; }

head1 "API contract (mobile schemas vs live API)"
if api_up; then (cd "$MOBILE" && npm run -s test:contract -- --silent) && ok "contract passed" || { fail "contract failed"; FAIL=1; }
else warn "SKIPPED contract — API not running"; fi

head1 "E2E (Maestro)"
MAESTRO="${MAESTRO:-$(command -v maestro || true)}"
if [ -n "$MAESTRO" ] && [ -n "${E2E_DEVICE:-}" ]; then
  (cd "$ROOT" && "$MAESTRO" --device "$E2E_DEVICE" test mobile/e2e/part1-core-journey.yaml) && ok "E2E-001 passed on $E2E_DEVICE" || { fail "E2E-001 failed"; FAIL=1; }
  PLATFORM=$([[ "$E2E_DEVICE" == emulator-* ]] && echo android || echo ios)
  E2E_DEVICE="$E2E_DEVICE" MAESTRO="$MAESTRO" "$ROOT/scripts/e2e-part2.sh" "$PLATFORM" && ok "E2E-002…012 passed" || { fail "Part 2 E2E failed"; FAIL=1; }
else warn "SKIPPED — set MAESTRO=/path/to/maestro and E2E_DEVICE=<simulator UDID|emulator-5554> (app installed, API + Metro running)"; fi
exit $FAIL
