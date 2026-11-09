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

head1 "Mobile: typecheck + unit/component tests"
(cd "$MOBILE" && npx tsc --noEmit && npx jest --silent) && ok "mobile passed" || { fail "mobile failed"; FAIL=1; }

head1 "API contract (mobile schemas vs live API)"
if api_up; then (cd "$MOBILE" && npm run -s test:contract -- --silent) && ok "contract passed" || { fail "contract failed"; FAIL=1; }
else warn "SKIPPED contract — API not running"; fi

head1 "E2E (Maestro)"
if command -v maestro >/dev/null; then warn "run manually with a booted simulator: maestro test mobile/e2e"; else warn "SKIPPED — Maestro CLI not installed"; fi
exit $FAIL
