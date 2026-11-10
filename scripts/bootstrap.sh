#!/usr/bin/env bash
# One-time project setup. Safe to re-run; never overwrites existing env files.
set -euo pipefail
source "$(dirname "$0")/lib.sh"

head1 "1/6 Prerequisites"
"$ROOT/scripts/doctor.sh" || warn "doctor reported problems — continuing with what is available"

head1 "2/6 Environment files"
for pair in "api/.env.example:api/.env" "mobile/.env.example:mobile/.env" ".env.example:.env"; do
  src="$ROOT/${pair%%:*}"; dst="$ROOT/${pair##*:}"
  if [ -f "$dst" ]; then ok "${pair##*:} exists (left untouched)"; elif [ -f "$src" ]; then cp "$src" "$dst"; ok "created ${pair##*:} from template"; fi
done

head1 "3/6 Mobile dependencies"
(cd "$MOBILE" && npm install) && ok "npm install complete"

head1 "4/6 iOS native dependencies"
if command -v pod >/dev/null && command -v xcodebuild >/dev/null; then
  "$ROOT/scripts/tools/pod-install.sh" && ok "pod install complete"
else warn "skipped (CocoaPods/Xcode missing) — brew install cocoapods, then: cd mobile/ios && pod install"; fi

head1 "5/6 Backend (Docker): build, migrate, seed"
if docker info >/dev/null 2>&1; then
  (cd "$ROOT" && docker compose up -d --build db redis mailpit api worker)
  for _ in $(seq 1 60); do api_up && break; sleep 2; done
  api_up && ok "API healthy" || die "API did not become healthy — docker compose logs api"
  (cd "$ROOT" && docker compose exec -T api python manage.py seed_zpot_lisbon --with-users)
else warn "Docker not running — start Docker Desktop and re-run"; fi

head1 "6/6 Credentials"
warn "Mapbox: set a public token (ZPOT_MAPBOX_PUBLIC_TOKEN=pk.…) in mobile/.env, or the map shows as unavailable (docs/development/maps.md)."
warn "Seeded dev users and their generated passwords are printed above — store them yourself."
ok "Done. Next: scripts/start-android.sh or scripts/start-ios.sh"
