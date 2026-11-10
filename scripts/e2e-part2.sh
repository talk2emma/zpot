#!/usr/bin/env bash
# Runs the Part 2 Maestro journeys (E2E-002…012) against the REAL local API (no mocks).
# Usage: scripts/e2e-part2.sh <ios|android> [flow-glob]      e.g. scripts/e2e-part2.sh ios 'e2e-00[4-6]*'
# Needs: docker compose stack up + seeded, the debug app installed on the booted device, Metro on :8081, maestro.
set -uo pipefail
source "$(dirname "$0")/lib.sh"
PLATFORM="${1:?ios|android}"; GLOB="${2:-e2e-*}"
MAESTRO="${MAESTRO:-$(command -v maestro || echo "$HOME/Downloads/maestro/bin/maestro")}"
export MAESTRO_DRIVER_STARTUP_TIMEOUT="${MAESTRO_DRIVER_STARTUP_TIMEOUT:-180000}"  # XCTest driver can be slow to boot
[ -x "$MAESTRO" ] || die "maestro not found (set MAESTRO=/path/to/maestro)"
api_up || die "API not reachable on :8000 — scripts/start-api.sh --seed"
FLOWS="$MOBILE/e2e/part2"; OUT="$ROOT/docs/e2e-results/$PLATFORM"; mkdir -p "$OUT"
if [ "$PLATFORM" = android ]; then DEVICE="${E2E_DEVICE:-emulator-5554}"; adb -s "$DEVICE" reverse tcp:8000 tcp:8000 >/dev/null; adb -s "$DEVICE" reverse tcp:8081 tcp:8081 >/dev/null
else DEVICE="${E2E_DEVICE:-$(xcrun simctl list devices booted | grep -Eo '[0-9A-F-]{36}' | head -1)}"; fi
[ -n "$DEVICE" ] || die "No booted device"

# Throwaway password for the seeded dev users — generated per run, never written to disk.
PASSWORD="E2e-$(openssl rand -hex 6)"
docker compose -f "$ROOT/docker-compose.yml" exec -T -e ZPOT_SEED_PASSWORD="$PASSWORD" api python manage.py seed_zpot_lisbon --with-users >/dev/null \
  || die "seeding failed"

reset_driver() {  # test isolation: only the driver's own session/saved state and e2e-created reports
  docker compose -f "$ROOT/docker-compose.yml" exec -T api python manage.py shell -c "
from django.utils import timezone
from apps.sessions.models import ParkingSession
from apps.saved.models import SavedParkingLocation
from apps.reports.models import CommunityReport
ParkingSession.objects.filter(user__email='driver@zpot.dev', status='active').update(status='ended', ended_at=timezone.now())
SavedParkingLocation.objects.filter(user__email='driver@zpot.dev').delete()
from apps.notifications.models import Notification
Notification.objects.filter(user__email='driver@zpot.dev').delete()
from apps.accounts.models import ConsentRecord
ConsentRecord.objects.filter(user__email='driver@zpot.dev', source='consent_prompt').delete()
for r in CommunityReport.objects.filter(client_token__startswith='e2e-'):
    o = r.observation; r.delete(); o and o.delete()
CommunityReport.objects.filter(reporter__email='driver@zpot.dev', description__startswith='E2E').delete()
" >/dev/null
}

PASS=0; FAIL=0; : > "$OUT/summary.txt"
run() {  # run <flow> [label]
  local f="$1" label="${2:-$(basename "$1" .yaml)}"
  if "$MAESTRO" --device "$DEVICE" test "$f" -e EMAIL=driver@zpot.dev -e PASSWORD="$PASSWORD" \
      -e API=http://localhost:8000/api/v1 -e MAILPIT=http://localhost:8025 --test-output-dir "$OUT/$label" > "$OUT/$label.log" 2>&1; then
    ok "$label"; echo "PASS $label" >> "$OUT/summary.txt"; PASS=$((PASS+1)); return 0
  else
    warn "$label FAILED — see $OUT/$label.log"; echo "FAIL $label" >> "$OUT/summary.txt"; FAIL=$((FAIL+1)); return 1
  fi
}

for f in "$FLOWS"/$GLOB.yaml; do
  name=$(basename "$f" .yaml)
  case "$name" in
    e2e-010b-*|e2e-010c-*) continue ;;
    e2e-010a-*)  # network failure: stop the API between steps, then restore it
      reset_driver
      if run "$f" e2e-010a; then
        docker compose -f "$ROOT/docker-compose.yml" stop api >/dev/null
        run "$FLOWS/e2e-010b-network.yaml" e2e-010b; b=$?
        docker compose -f "$ROOT/docker-compose.yml" start api >/dev/null
        until api_up; do sleep 1; done
        [ $b -eq 0 ] && run "$FLOWS/e2e-010c-network.yaml" e2e-010c
      fi ;;
    *) reset_driver; run "$f" ;;
  esac
done
echo "PASS=$PASS FAIL=$FAIL" | tee -a "$OUT/summary.txt"
[ "$FAIL" -eq 0 ]
