#!/usr/bin/env bash
# Starts PostGIS, Redis, Mailpit, API and Celery worker; applies migrations; optional seed.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
docker info >/dev/null 2>&1 || die "Docker is not running"
[ -f "$ROOT/api/.env" ] || cp "$ROOT/api/.env.example" "$ROOT/api/.env"
(cd "$ROOT" && docker compose up -d db redis mailpit api worker)
for _ in $(seq 1 60); do api_up && break; sleep 2; done
api_up || die "API not healthy — docker compose logs api"
curl -fsS http://localhost:8000/api/v1/ready/ >/dev/null && ok "API ready: http://localhost:8000/api/v1/ (docs: /api/v1/docs/)" || warn "API up but not ready — check /api/v1/ready/"
if [ "${1:-}" = "--seed" ]; then (cd "$ROOT" && docker compose exec -T api python manage.py seed_zpot_lisbon); fi
ok "Mailpit (captured emails): http://localhost:8025"
