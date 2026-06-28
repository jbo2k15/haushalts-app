#!/usr/bin/env bash
# Full deploy: pull, build, start, smoke test
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

echo "▸ Git pull..."
git pull

echo "▸ Docker build & start..."
DOCKER_BUILDKIT=1 docker compose up --build -d

echo "▸ Warte 15s auf Container-Start..."
sleep 15

echo "▸ Smoke Test..."
bash scripts/smoke-test.sh

echo ""
echo "✓ Deploy abgeschlossen."
