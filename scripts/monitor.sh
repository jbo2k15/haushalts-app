#!/usr/bin/env bash
# Health monitor — checks /api/health every run and sends email on failure/recovery.
# Run via cron every 5 minutes:
#   */5 * * * * /opt/haushalts-app/scripts/monitor.sh >> /var/log/haushalts-monitor.log 2>&1
#
# State is tracked in /tmp/haushalts-monitor-state:
#   fail:<count>   — consecutive failures so far
#   notified       — email sent, waiting for recovery
#   ok             — last check was healthy

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"
STATE_FILE="/tmp/haushalts-monitor-state"
BASE_URL="${APP_URL:-http://localhost:80}"
# Send alert after this many consecutive failures (5 checks × 5 min = 25 min downtime)
ALERT_AFTER=5

# ── Read .env ────────────────────────────────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  echo "[Monitor] .env nicht gefunden: $ENV_FILE" >&2
  exit 1
fi

get_env() {
  grep -E "^${1}=" "$ENV_FILE" | head -1 | cut -d'=' -f2- | tr -d '"' | tr -d "'"
}

SMTP_HOST="$(get_env SMTP_HOST)"
SMTP_PORT="$(get_env SMTP_PORT)"
SMTP_USER="$(get_env SMTP_USER)"
SMTP_PASS="$(get_env SMTP_PASS)"
ADMIN_EMAIL="$(get_env ADMIN_EMAIL)"
FRONTEND_URL="$(get_env FRONTEND_URL)"

if [ -z "$SMTP_USER" ] || [ -z "$SMTP_PASS" ] || [ -z "$ADMIN_EMAIL" ]; then
  echo "[Monitor] SMTP-Konfiguration unvollständig — Monitor nicht aktiv" >&2
  exit 1
fi

# ── Health check ─────────────────────────────────────────────────────────────
HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" \
  --max-time 10 "$BASE_URL/api/health" 2>/dev/null || echo "000")

NOW="$(date '+%Y-%m-%d %H:%M:%S')"

# ── State ────────────────────────────────────────────────────────────────────
STATE="$(cat "$STATE_FILE" 2>/dev/null || echo "ok")"
FAIL_COUNT=0
if [[ "$STATE" == fail:* ]]; then
  FAIL_COUNT="${STATE#fail:}"
fi

# ── Send email via curl SMTP ──────────────────────────────────────────────────
send_email() {
  local subject="$1"
  local body="$2"
  local date_rfc
  date_rfc="$(date -R)"

  curl --silent --ssl-reqd \
    --url "smtp://${SMTP_HOST}:${SMTP_PORT}" \
    --user "${SMTP_USER}:${SMTP_PASS}" \
    --mail-from "${SMTP_USER}" \
    --mail-rcpt "${ADMIN_EMAIL}" \
    --upload-file - <<EOF
From: Haushalts-App <${SMTP_USER}>
To: ${ADMIN_EMAIL}
Subject: ${subject}
Date: ${date_rfc}
Content-Type: text/plain; charset=utf-8

${body}
EOF
  echo "[Monitor] E-Mail gesendet: $subject"
}

# ── Logic ─────────────────────────────────────────────────────────────────────
if [ "$HTTP_CODE" = "200" ]; then
  echo "[Monitor] $NOW — OK (HTTP 200)"

  if [ "$STATE" = "notified" ]; then
    # Recovery after outage
    send_email "✅ Haushalts-App wieder erreichbar" \
"Die App ist wieder online.

URL: ${FRONTEND_URL:-$BASE_URL}
Zeit: $NOW"
  fi

  echo "ok" > "$STATE_FILE"
else
  NEW_COUNT=$((FAIL_COUNT + 1))
  echo "[Monitor] $NOW — FEHLER (HTTP $HTTP_CODE), Fehlschlag $NEW_COUNT/$ALERT_AFTER"

  if [ "$STATE" = "notified" ]; then
    # Already notified, keep waiting
    echo "notified" > "$STATE_FILE"
  elif [ "$NEW_COUNT" -ge "$ALERT_AFTER" ]; then
    # Threshold reached — send alert
    send_email "🚨 Haushalts-App nicht erreichbar" \
"Die App antwortet nicht mehr.

URL: ${FRONTEND_URL:-$BASE_URL}
HTTP-Status: $HTTP_CODE
Zeit: $NOW
Fehlschläge: $NEW_COUNT

Mögliche Ursachen:
  - Docker-Container abgestürzt: docker ps
  - Logs prüfen: docker logs haushalts-app-backend-1
  - Neustart: deploy"
    echo "notified" > "$STATE_FILE"
  else
    echo "fail:$NEW_COUNT" > "$STATE_FILE"
  fi
fi
