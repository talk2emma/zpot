.PHONY: doctor bootstrap api android ios seed reset-db test test-api test-mobile contract lint schema logs down

doctor:      ; ./scripts/doctor.sh
bootstrap:   ; ./scripts/bootstrap.sh
api:         ; ./scripts/start-api.sh
android:     ; ./scripts/start-android.sh
ios:         ; ./scripts/start-ios.sh
seed:        ; docker compose exec -T api python manage.py seed_zpot_lisbon
reset-db:    ; ./scripts/reset-local-db.sh
test:        ; ./scripts/run-tests.sh
test-api:    ; docker compose exec -T api pytest -q
test-mobile: ; cd mobile && npx tsc --noEmit && npx jest
contract:    ; cd mobile && npm run test:contract
lint:        ; docker compose exec -T api ruff check . && cd mobile && npx eslint src --ext .ts,.tsx
schema:      ; docker compose exec -T api python manage.py spectacular --file docs/../openapi.yaml >/dev/null && mv api/openapi.yaml docs/api/openapi.yaml && echo "docs/api/openapi.yaml updated"
logs:        ; docker compose logs -f api worker
down:        ; docker compose down
