#!/usr/bin/env bash
# Smoke test after deploy — checks API endpoints and iCal reachability
# Usage: bash scripts/smoke-test.sh [base-url]
#   Default base-url: http://localhost:80
#   iCal URL is read from WASTE_ICAL_URL env var or .env file in repo root

set -euo pipefail

BASE_URL="${1:-${APP_URL:-http://localhost:80}}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Read WASTE_ICAL_URL from .env if not already set
if [ -z "${WASTE_ICAL_URL:-}" ] && [ -f "$REPO_ROOT/.env" ]; then
  WASTE_ICAL_URL=$(grep -E '^WASTE_ICAL_URL=' "$REPO_ROOT/.env" | cut -d'=' -f2- | tr -d '"' | tr -d "'") || true
fi

PASS=0
FAIL=0
WARN=0

ok()   { echo "  ✓ $1"; ((PASS++)); }
fail() { echo "  ✗ $1"; ((FAIL++)); }
warn() { echo "  ! $1"; ((WARN++)); }

echo ""
echo "═══════════════════════════════════════"
echo "  Smoke Test — $(date '+%Y-%m-%d %H:%M')"
echo "  $BASE_URL"
echo "═══════════════════════════════════════"

# Wait for server to be ready (up to 30s)
echo ""
echo "▸ Warte auf Server..."
for i in $(seq 1 15); do
  CODE=$(curl -sf -o /dev/null -w "%{http_code}" "$BASE_URL/api/health" 2>/dev/null || echo "000")
  if [ "$CODE" = "200" ]; then break; fi
  sleep 2
done

# ── API Health ──────────────────────────────
echo ""
echo "▸ API Health"
BODY=$(curl -sf "$BASE_URL/api/health" 2>/dev/null || echo "")
if echo "$BODY" | grep -q '"status":"ok"'; then
  ok "GET /api/health → 200 ok"
else
  fail "GET /api/health → nicht erreichbar oder falsches Format"
fi

# ── Auth Guard ──────────────────────────────
echo ""
echo "▸ Auth Guard"
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/tasks" 2>/dev/null)
if [ "$CODE" = "401" ]; then
  ok "GET /api/tasks ohne Token → 401"
else
  fail "GET /api/tasks ohne Token → $CODE (erwartet 401)"
fi

CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/tasks/stats" 2>/dev/null)
if [ "$CODE" = "401" ]; then
  ok "GET /api/tasks/stats ohne Token → 401"
else
  fail "GET /api/tasks/stats ohne Token → $CODE (erwartet 401)"
fi

# ── Auth Login (falsche Credentials) ────────
echo ""
echo "▸ Auth Endpoint"
CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"smoke@test.invalid","password":"WrongPw123!"}' 2>/dev/null)
if [ "$CODE" = "401" ]; then
  ok "POST /api/auth/login (falsche Credentials) → 401"
else
  fail "POST /api/auth/login → $CODE (erwartet 401)"
fi

CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{}' 2>/dev/null)
if [ "$CODE" = "401" ] || [ "$CODE" = "400" ]; then
  ok "POST /api/auth/login (leerer Body) → $CODE"
else
  fail "POST /api/auth/login (leerer Body) → $CODE (erwartet 400/401)"
fi

# ── Rate Limiting (nicht zu aggressiv testen) ─
echo ""
echo "▸ Rate Limiting"
CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"x","password":"x","name":"x"}' 2>/dev/null)
if [ "$CODE" = "400" ] || [ "$CODE" = "409" ] || [ "$CODE" = "429" ]; then
  ok "POST /api/auth/register reagiert ($CODE)"
else
  fail "POST /api/auth/register → $CODE"
fi

# ── Admin Guard ─────────────────────────────
echo ""
echo "▸ Admin Guard"
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/users" 2>/dev/null)
if [ "$CODE" = "401" ]; then
  ok "GET /api/users ohne Token → 401"
else
  fail "GET /api/users ohne Token → $CODE (erwartet 401)"
fi

CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X DELETE "$BASE_URL/api/users/nonexistent-id" 2>/dev/null)
if [ "$CODE" = "401" ]; then
  ok "DELETE /api/users/:id ohne Token → 401"
else
  fail "DELETE /api/users/:id ohne Token → $CODE (erwartet 401)"
fi

CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/tasks/admin" 2>/dev/null)
if [ "$CODE" = "401" ]; then
  ok "GET /api/tasks/admin ohne Token → 401"
else
  fail "GET /api/tasks/admin ohne Token → $CODE (erwartet 401)"
fi

# ── Input Validierung ────────────────────────
echo ""
echo "▸ Input Validierung"
CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.de","password":"schwach","name":"Test"}' 2>/dev/null)
if [ "$CODE" = "400" ]; then
  ok "Registrierung mit schwachem Passwort → 400"
else
  fail "Registrierung mit schwachem Passwort → $CODE (erwartet 400)"
fi

CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test@test.de\",\"password\":\"Test1234!\",\"name\":\"$(python3 -c 'print("x"*101)' 2>/dev/null || printf '%0.s x' {1..101})\"}" 2>/dev/null)
if [ "$CODE" = "400" ]; then
  ok "Registrierung mit zu langem Namen → 400"
else
  warn "Registrierung mit zu langem Namen → $CODE (erwartet 400)"
fi

# Zu großer Request-Body (über 100kb Limit)
BIG_BODY=$(python3 -c 'print("{\"x\":\"" + "a"*110000 + "\"}")' 2>/dev/null || dd if=/dev/zero bs=110000 count=1 2>/dev/null | tr '\0' 'a' || echo "")
if [ -n "$BIG_BODY" ]; then
  CODE=$(echo "$BIG_BODY" | curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    --data-binary @- 2>/dev/null)
  if [ "$CODE" = "413" ] || [ "$CODE" = "400" ] || [ "$CODE" = "401" ]; then
    ok "Zu großer Request-Body → $CODE (abgelehnt)"
  else
    warn "Zu großer Request-Body → $CODE"
  fi
fi

# ── Sicherheits-Header ───────────────────────
echo ""
echo "▸ Sicherheits-Header"
HEADERS=$(curl -sI "$BASE_URL/api/health" 2>/dev/null)

if echo "$HEADERS" | grep -qi "x-frame-options"; then
  ok "X-Frame-Options Header vorhanden"
else
  warn "X-Frame-Options Header fehlt"
fi

if echo "$HEADERS" | grep -qi "x-content-type-options"; then
  ok "X-Content-Type-Options Header vorhanden"
else
  warn "X-Content-Type-Options Header fehlt"
fi

# ── 404 Handling ─────────────────────────────
echo ""
echo "▸ 404 Handling"
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/nonexistent-route" 2>/dev/null)
if [ "$CODE" = "404" ] || [ "$CODE" = "401" ]; then
  ok "Unbekannte API-Route → $CODE"
else
  warn "Unbekannte API-Route → $CODE"
fi

# ── VAPID Key ────────────────────────────────
echo ""
echo "▸ Push / VAPID"
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/vapid-public-key" 2>/dev/null)
if [ "$CODE" = "401" ]; then
  ok "GET /api/vapid-public-key ohne Token → 401 (auth guard aktiv)"
else
  warn "GET /api/vapid-public-key → $CODE"
fi

# ── iCal Feed ────────────────────────────────
echo ""
echo "▸ iCal Feed"
if [ -n "${WASTE_ICAL_URL:-}" ]; then
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "$WASTE_ICAL_URL" 2>/dev/null || echo "000")
  if [ "$CODE" = "200" ]; then
    ok "iCal Feed erreichbar → 200"
  elif [ "$CODE" = "000" ]; then
    fail "iCal Feed nicht erreichbar (Timeout)"
  else
    warn "iCal Feed → HTTP $CODE"
  fi
else
  warn "WASTE_ICAL_URL nicht gesetzt — iCal-Check übersprungen"
fi

# ── Zusammenfassung ──────────────────────────
echo ""
echo "═══════════════════════════════════════"
echo "  Ergebnis: $PASS ✓  $WARN !  $FAIL ✗"
echo "═══════════════════════════════════════"
echo ""

if [ $FAIL -gt 0 ]; then
  echo "  FEHLER — Deploy prüfen!" >&2
  exit 1
fi
exit 0
