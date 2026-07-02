#!/usr/bin/env bash
# Full deploy: pull, build only changed services, start, smoke test
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

OLD_HEAD="$(git rev-parse HEAD)"

echo "▸ Git pull..."
git pull

NEW_HEAD="$(git rev-parse HEAD)"

BACKEND_IMAGE_MISSING=false
FRONTEND_IMAGE_MISSING=false
docker image inspect haushalts-app-backend >/dev/null 2>&1 || BACKEND_IMAGE_MISSING=true
docker image inspect haushalts-app-frontend >/dev/null 2>&1 || FRONTEND_IMAGE_MISSING=true

if [ "$OLD_HEAD" = "$NEW_HEAD" ] && [ "$BACKEND_IMAGE_MISSING" = false ] && [ "$FRONTEND_IMAGE_MISSING" = false ]; then
  echo "▸ Keine neuen Commits — nichts zu tun."
  exit 0
fi

CHANGED_FILES="$(git diff --name-only "$OLD_HEAD" "$NEW_HEAD")"
BACKEND_CHANGED=false
FRONTEND_CHANGED=false
echo "$CHANGED_FILES" | grep -q '^backend/' && BACKEND_CHANGED=true
echo "$CHANGED_FILES" | grep -q '^frontend/' && FRONTEND_CHANGED=true
[ "$BACKEND_IMAGE_MISSING" = true ] && BACKEND_CHANGED=true
[ "$FRONTEND_IMAGE_MISSING" = true ] && FRONTEND_CHANGED=true

if [ "$BACKEND_CHANGED" = false ] && [ "$FRONTEND_CHANGED" = false ]; then
  echo "▸ Keine Änderungen an backend/ oder frontend/ — kein Rebuild nötig."
  exit 0
fi

if [ "$BACKEND_CHANGED" = true ]; then
  echo "▸ Backend-Tests..."
  (cd backend && npm ci --silent && npm test)
fi

if [ "$FRONTEND_CHANGED" = true ]; then
  echo "▸ Frontend E2E-Tests (Playwright)..."
  (cd frontend && npm ci --silent && npx playwright install --with-deps chromium && npm run test:e2e)
fi

SERVICES=""
[ "$BACKEND_CHANGED" = true ] && SERVICES="$SERVICES backend"
[ "$FRONTEND_CHANGED" = true ] && SERVICES="$SERVICES frontend"

echo "▸ Docker build für:$SERVICES"
DOCKER_BUILDKIT=1 docker compose build $SERVICES

echo "▸ Container-Start..."
docker compose up -d

echo "▸ Warte 15s auf Container-Start..."
sleep 15

echo "▸ Smoke Test..."
bash scripts/smoke-test.sh

echo ""
echo "✓ Deploy abgeschlossen ($SERVICES neu gebaut)."
