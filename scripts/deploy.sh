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

# ── CI-Gate ────────────────────────────────────────────────────────────────
# Nur deployen, wenn der GitHub-Actions-CI-Lauf (.github/workflows/ci.yml) fuer
# genau diesen Commit gruen abgeschlossen ist (Kopplung an CI, beschlossen
# 2026-07-24). Notfall-Ueberbrueckung: SKIP_CI_CHECK=1 bash scripts/deploy.sh
if [ "${SKIP_CI_CHECK:-0}" = "1" ]; then
  echo "▸ CI-Check uebersprungen (SKIP_CI_CHECK=1)."
else
  echo "▸ Pruefe CI-Status fuer $CURRENT_HEAD..."
  CI_CONCLUSION=""
  # Bevorzugt der praezise Pfad ueber die GitHub CLI (falls installiert +
  # authentifiziert).
  if command -v gh >/dev/null 2>&1; then
    CI_CONCLUSION="$(gh run list --workflow=ci.yml --branch=main --limit 40 \
      --json headSha,status,conclusion \
      --jq "[.[] | select(.headSha==\"$CURRENT_HEAD\" and .status==\"completed\")] | first | .conclusion" \
      2>/dev/null || echo "")"
    [ "$CI_CONCLUSION" = "null" ] && CI_CONCLUSION=""
  fi
  # Fallback ohne gh: das Repo ist oeffentlich, also laesst sich die GitHub-
  # REST-API anonym per curl abfragen (kein Token/Login noetig). Liefert die
  # ci.yml-Laeufe fuer genau diesen Commit (neueste zuerst); wir nehmen die
  # conclusion des ersten abgeschlossenen Laufs (in-progress -> conclusion null,
  # wird uebersprungen).
  if [ -z "$CI_CONCLUSION" ] && command -v curl >/dev/null 2>&1; then
    GH_API="https://api.github.com/repos/jbo2k15/haushalts-app/actions/workflows/ci.yml/runs?head_sha=${CURRENT_HEAD}&per_page=20"
    RUNS_JSON="$(curl -fsSL -H 'Accept: application/vnd.github+json' "$GH_API" 2>/dev/null || echo "")"
    CI_CONCLUSION="$(printf '%s' "$RUNS_JSON" \
      | grep -oE '"conclusion"[[:space:]]*:[[:space:]]*(null|"[a-z_]+")' \
      | sed -E 's/.*:[[:space:]]*//; s/"//g' \
      | grep -v '^null$' | head -n1)"
  fi
  if [ "$CI_CONCLUSION" = "success" ]; then
    echo "▸ CI gruen fuer diesen Commit."
  elif [ -z "$CI_CONCLUSION" ]; then
    echo "✗ Kein abgeschlossener CI-Lauf fuer $CURRENT_HEAD gefunden (laeuft noch, fehlt, oder API nicht erreichbar)." >&2
    echo "  Warten bis CI durch ist, oder mit SKIP_CI_CHECK=1 ueberbruecken." >&2
    exit 1
  else
    echo "✗ CI fuer diesen Commit nicht gruen (conclusion: $CI_CONCLUSION)." >&2
    exit 1
  fi
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

# npm ci ist nur nötig, wenn sich die jeweilige Lockfile seit dem letzten
# Deploy geändert hat (oder node_modules noch gar nicht existiert) — sonst
# ist der bereits installierte Stand identisch. Bei leerem LAST_DEPLOYED
# (erster Deploy auf diesem Host) gilt sicherheitshalber "geändert".
if [ -z "$LAST_DEPLOYED" ]; then
  BACKEND_LOCKFILE_CHANGED=true
  FRONTEND_LOCKFILE_CHANGED=true
else
  BACKEND_LOCKFILE_CHANGED=false
  FRONTEND_LOCKFILE_CHANGED=false
  echo "$CHANGED_FILES" | grep -q '^backend/package-lock\.json$' && BACKEND_LOCKFILE_CHANGED=true
  echo "$CHANGED_FILES" | grep -q '^frontend/package-lock\.json$' && FRONTEND_LOCKFILE_CHANGED=true
fi
[ -d backend/node_modules ] || BACKEND_LOCKFILE_CHANGED=true
[ -d frontend/node_modules ] || FRONTEND_LOCKFILE_CHANGED=true

# The e2e tests spin up a real backend server, so backend deps are needed
# whenever the frontend is tested too — not just when backend/ itself changed.
if [ "$BACKEND_CHANGED" = true ] || [ "$FRONTEND_CHANGED" = true ]; then
  if [ "$BACKEND_LOCKFILE_CHANGED" = true ]; then
    echo "▸ Backend-Abhängigkeiten installieren..."
    (cd backend && npm ci --silent)
  else
    echo "▸ Backend-Lockfile unverändert — npm ci übersprungen."
  fi
  # schema.prisma kann sich auch ohne Lockfile-Änderung ändern (z.B. neue
  # Migration) - Client-Generierung deshalb unabhängig vom npm-ci-Skip.
  (cd backend && npx prisma generate)
fi

if [ "$BACKEND_CHANGED" = true ]; then
  echo "▸ Backend-Tests..."
  (cd backend && npm test)
fi

if [ "$FRONTEND_CHANGED" = true ]; then
  if [ "$FRONTEND_LOCKFILE_CHANGED" = true ]; then
    echo "▸ Frontend-Abhängigkeiten installieren..."
    (cd frontend && npm ci --silent)
  else
    echo "▸ Frontend-Lockfile unverändert — npm ci übersprungen."
  fi
  echo "▸ Frontend E2E-Tests (Playwright)..."
  (cd frontend && npx playwright install --with-deps chromium && npm run test:e2e)
fi

# node_modules bleiben jetzt zwischen Deploys erhalten (siehe Lockfile-Check
# oben) - kostet dauerhaft ca. 500MB, spart aber einen vollen npm ci bei
# jedem Deploy ohne Dependency-Änderung. Build-Artefakte dagegen bei jedem
# Lauf frisch erzeugt, daher hier weiterhin aufräumen.
rm -rf frontend/dist frontend/test-results

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
