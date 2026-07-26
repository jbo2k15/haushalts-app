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
  # Ermittelt die conclusion des ci.yml-Laufs fuer CURRENT_HEAD und gibt sie auf
  # stdout aus (leer, solange noch kein Lauf abgeschlossen ist -> conclusion
  # null). Bevorzugt gh (falls installiert + authentifiziert), sonst anonym per
  # curl gegen die oeffentliche GitHub-API (Repo ist oeffentlich, kein Token
  # noetig). Nimmt die conclusion des ersten abgeschlossenen Laufs.
  get_ci_conclusion() {
    local conc=""
    if command -v gh >/dev/null 2>&1; then
      conc="$(gh run list --workflow=ci.yml --branch=main --limit 40 \
        --json headSha,status,conclusion \
        --jq "[.[] | select(.headSha==\"$CURRENT_HEAD\" and .status==\"completed\")] | first | .conclusion" \
        2>/dev/null || echo "")"
      if [ "$conc" = "null" ]; then conc=""; fi
    fi
    if [ -z "$conc" ] && command -v curl >/dev/null 2>&1; then
      local api="https://api.github.com/repos/jbo2k15/haushalts-app/actions/workflows/ci.yml/runs?head_sha=${CURRENT_HEAD}&per_page=20"
      local json
      json="$(curl -fsSL -H 'Accept: application/vnd.github+json' "$api" 2>/dev/null || echo "")"
      conc="$(printf '%s' "$json" \
        | grep -oE '"conclusion"[[:space:]]*:[[:space:]]*(null|"[a-z_]+")' \
        | sed -E 's/.*:[[:space:]]*//; s/"//g' \
        | grep -v '^null$' | head -n1)"
    fi
    printf '%s' "$conc"
  }

  # Kurz auf CI warten, statt sofort abzubrechen: ein direkt nach dem Push
  # gestarteter Deploy trifft den Lauf sonst noch waehrend er laeuft
  # (conclusion leer) und wuerde faelschlich abbrechen. Alle POLL_INTERVAL_S
  # nachfragen, bis max. CI_WAIT_MAX_S; beide per Env ueberschreibbar.
  CI_WAIT_MAX_S="${CI_WAIT_MAX_S:-480}"
  POLL_INTERVAL_S="${POLL_INTERVAL_S:-15}"
  echo "▸ Pruefe CI-Status fuer $CURRENT_HEAD..."
  CI_CONCLUSION=""
  elapsed=0
  while :; do
    CI_CONCLUSION="$(get_ci_conclusion)"
    if [ -n "$CI_CONCLUSION" ]; then break; fi
    if [ "$elapsed" -ge "$CI_WAIT_MAX_S" ]; then break; fi
    echo "▸ Noch kein abgeschlossener CI-Lauf — warte ${POLL_INTERVAL_S}s… (${elapsed}s/${CI_WAIT_MAX_S}s)"
    sleep "$POLL_INTERVAL_S"
    elapsed=$((elapsed + POLL_INTERVAL_S))
  done

  if [ "$CI_CONCLUSION" = "success" ]; then
    echo "▸ CI gruen fuer diesen Commit."
  elif [ -z "$CI_CONCLUSION" ]; then
    echo "✗ Nach ${CI_WAIT_MAX_S}s kein abgeschlossener CI-Lauf fuer $CURRENT_HEAD (laeuft noch, fehlt, oder API nicht erreichbar)." >&2
    echo "  Laenger warten (CI_WAIT_MAX_S=... deploy), oder mit SKIP_CI_CHECK=1 ueberbruecken." >&2
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
