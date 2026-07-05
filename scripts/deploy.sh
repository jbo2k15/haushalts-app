#!/usr/bin/env bash
# Full deploy: pull, build only changed services, start, smoke test
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

LAST_DEPLOY_FILE="$REPO_ROOT/.last-deploy"

echo "▸ Git pull..."
git pull

CURRENT_HEAD="$(git rev-parse HEAD)"
LAST_DEPLOYED="$(cat "$LAST_DEPLOY_FILE" 2>/dev/null || echo "")"

BACKEND_IMAGE_MISSING=false
FRONTEND_IMAGE_MISSING=false
docker image inspect haushalts-app-backend >/dev/null 2>&1 || BACKEND_IMAGE_MISSING=true
docker image inspect haushalts-app-frontend >/dev/null 2>&1 || FRONTEND_IMAGE_MISSING=true

if [ "$LAST_DEPLOYED" = "$CURRENT_HEAD" ] && [ "$BACKEND_IMAGE_MISSING" = false ] && [ "$FRONTEND_IMAGE_MISSING" = false ]; then
  echo "▸ Bereits auf dem zuletzt deployten Stand — nichts zu tun."
  exit 0
fi

if [ -z "$LAST_DEPLOYED" ]; then
  BACKEND_CHANGED=true
  FRONTEND_CHANGED=true
else
  CHANGED_FILES="$(git diff --name-only "$LAST_DEPLOYED" "$CURRENT_HEAD")"
  BACKEND_CHANGED=false
  FRONTEND_CHANGED=false
  echo "$CHANGED_FILES" | grep -q '^backend/' && BACKEND_CHANGED=true
  echo "$CHANGED_FILES" | grep -q '^frontend/' && FRONTEND_CHANGED=true
fi
[ "$BACKEND_IMAGE_MISSING" = true ] && BACKEND_CHANGED=true
[ "$FRONTEND_IMAGE_MISSING" = true ] && FRONTEND_CHANGED=true

if [ "$BACKEND_CHANGED" = false ] && [ "$FRONTEND_CHANGED" = false ]; then
  echo "▸ Keine Änderungen an backend/ oder frontend/ — kein Rebuild nötig."
  echo "$CURRENT_HEAD" > "$LAST_DEPLOY_FILE"
  exit 0
fi

# The e2e tests spin up a real backend server, so backend deps are needed
# whenever the frontend is tested too — not just when backend/ itself changed.
if [ "$BACKEND_CHANGED" = true ] || [ "$FRONTEND_CHANGED" = true ]; then
  echo "▸ Backend-Abhängigkeiten installieren..."
  (cd backend && npm ci --silent && npx prisma generate)
fi

if [ "$BACKEND_CHANGED" = true ]; then
  echo "▸ Backend-Tests..."
  (cd backend && npm test)
fi

if [ "$FRONTEND_CHANGED" = true ]; then
  echo "▸ Frontend E2E-Tests (Playwright)..."
  (cd frontend && npm ci --silent && npx playwright install --with-deps chromium && npm run test:e2e)
fi

# Host node_modules is only needed to run the tests above — the Docker build
# does its own isolated npm ci inside the container. This box has very
# little disk, so don't leave them lying around. Keep ~/.cache/ms-playwright
# though: re-downloading Chromium every deploy would be worse than the
# space it costs.
rm -rf backend/node_modules frontend/node_modules frontend/dist frontend/test-results

SERVICES=""
[ "$BACKEND_CHANGED" = true ] && SERVICES="$SERVICES backend"
[ "$FRONTEND_CHANGED" = true ] && SERVICES="$SERVICES frontend"

echo "▸ Docker build für:$SERVICES"
DOCKER_BUILDKIT=1 docker compose build $SERVICES

echo "▸ Container-Start..."
docker compose up -d

# smoke-test.sh polls /api/health itself (up to 30s) before running its
# checks, so a fixed sleep here would just waste time on top of that.
echo "▸ Smoke Test..."
bash scripts/smoke-test.sh

echo "$CURRENT_HEAD" > "$LAST_DEPLOY_FILE"

echo ""
echo "✓ Deploy abgeschlossen ($SERVICES neu gebaut)."
