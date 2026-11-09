#!/usr/bin/env bash
# DESTRUCTIVE (local only): drops the local database volume, re-migrates and re-seeds.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
if [ "${1:-}" != "--yes" ]; then
  read -r -p "This deletes ALL local Zpot database data. Type 'reset' to continue: " a; [ "$a" = "reset" ] || die "aborted"
fi
(cd "$ROOT" && docker compose down -v --remove-orphans && docker compose up -d db redis mailpit api worker)
for _ in $(seq 1 60); do api_up && break; sleep 2; done
api_up || die "API not healthy"
(cd "$ROOT" && docker compose exec -T api python manage.py seed_zpot_lisbon --with-users)
ok "Local database reset and seeded"
