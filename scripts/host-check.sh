#!/usr/bin/env bash
# Host-Check: prüft den Server (LXC bzw. Proxmox-Host), auf dem die App läuft.
# NUR LESEND - ändert nichts am System, installiert nichts, startet nichts neu.
#
#   bash scripts/host-check.sh          # Bericht im Terminal
#   bash scripts/host-check.sh --quiet  # nur Warnungen/Fehler (für Cron)
#
# Exit-Code: 0 = alles ok, 1 = mindestens eine Warnung, 2 = mindestens ein Fehler.
#
# Wöchentlich per Cron (als root, neben Backup/Trivy):
#   30 5 * * 1 /opt/haushalts-app/scripts/host-check.sh --quiet >> /var/log/haushalts-host-check.log 2>&1
#
# Auf dem Proxmox-HOST (nicht im Container) dieselbe Datei mit HOST_ROLE=proxmox
# aufrufen - dann entfallen die Docker-/App-Prüfungen:
#   HOST_ROLE=proxmox bash host-check.sh
#
# Schwellen per Umgebungsvariable überschreibbar (siehe Block "Einstellungen").
set -uo pipefail

# ── Einstellungen ────────────────────────────────────────────────────────────
HOST_ROLE="${HOST_ROLE:-app}"                      # app | proxmox
BACKUP_DIR="${BACKUP_DIR:-/opt/backups/haushalts-app}"
BACKUP_MAX_AGE_H="${BACKUP_MAX_AGE_H:-30}"         # nächtliches Backup → max. 30 h alt
TRIVY_LOG="${TRIVY_LOG:-/var/log/trivy-haushalts.log}"
TRIVY_MAX_AGE_D="${TRIVY_MAX_AGE_D:-8}"
DISK_WARN_PCT="${DISK_WARN_PCT:-80}"
DISK_FAIL_PCT="${DISK_FAIL_PCT:-92}"
MAX_UPTIME_D="${MAX_UPTIME_D:-60}"                 # länger ohne Neustart = Kernel-Patches nicht aktiv
# Ports, die außerhalb von localhost lauschen DÜRFEN (durch Leerzeichen getrennt).
# App-Container: 80 (Frontend, vom Tunnel angesprochen) + 22 (SSH).
# Proxmox-Host: zusätzlich 8006 (Weboberfläche), 3128 (spiceproxy), 111 (rpcbind).
if [ "$HOST_ROLE" = "proxmox" ]; then
  ALLOWED_PORTS="${ALLOWED_PORTS:-22 8006 3128 111}"
else
  ALLOWED_PORTS="${ALLOWED_PORTS:-22 80}"
fi

QUIET=false
[ "${1:-}" = "--quiet" ] && QUIET=true

WARN=0
FAIL=0
ok()   { $QUIET || printf '  \033[32m✓\033[0m %s\n' "$1"; }
info() { $QUIET || printf '  · %s\n' "$1"; }
warn() { WARN=$((WARN + 1)); printf '  \033[33m!\033[0m %s\n' "$1"; }
fail() { FAIL=$((FAIL + 1)); printf '  \033[31m✗\033[0m %s\n' "$1"; }
section() { $QUIET || printf '\n%s\n' "── $1 ──"; }
have() { command -v "$1" >/dev/null 2>&1; }

printf '%s\n' "Host-Check $(hostname) — $(TZ='Europe/Berlin' date '+%Y-%m-%d %H:%M') — Rolle: $HOST_ROLE"
[ "$(id -u)" -eq 0 ] || warn "Nicht als root gestartet — einige Prüfungen (Ports mit Prozessnamen, sshd-Konfiguration, Docker) sind unvollständig."

# ── 1. Betriebssystem-Updates ────────────────────────────────────────────────
section "Updates"
if have apt-get; then
  # Simulation: liest nur die lokalen Paketlisten. Sind die älter als 2 Tage,
  # ist das Ergebnis nicht aussagekräftig → eigener Hinweis.
  LISTS_AGE_D=""
  if [ -d /var/lib/apt/lists ]; then
    NEWEST="$(find /var/lib/apt/lists -maxdepth 1 -type f -printf '%T@\n' 2>/dev/null | sort -n | tail -1 | cut -d. -f1)"
    [ -n "$NEWEST" ] && LISTS_AGE_D=$(( ($(date +%s) - NEWEST) / 86400 ))
  fi
  if [ -n "$LISTS_AGE_D" ] && [ "$LISTS_AGE_D" -gt 2 ]; then
    warn "Paketlisten sind $LISTS_AGE_D Tage alt (kein automatisches 'apt update'?) — Update-Zahlen unten sind veraltet."
  fi
  SIM="$(apt-get -s -o Debug::NoLocking=true upgrade 2>/dev/null | grep '^Inst ' || true)"
  TOTAL="$(printf '%s' "$SIM" | grep -c . || true)"
  SEC="$(printf '%s' "$SIM" | grep -ci 'security' || true)"
  if [ "${SEC:-0}" -gt 0 ]; then
    fail "$SEC ausstehende Sicherheitsupdates ($TOTAL Updates insgesamt) — 'apt update && apt upgrade'."
  elif [ "${TOTAL:-0}" -gt 0 ]; then
    warn "$TOTAL ausstehende Updates (keine als Sicherheitsupdate markiert)."
  else
    ok "Keine ausstehenden Paket-Updates."
  fi

  if dpkg -s unattended-upgrades >/dev/null 2>&1 \
     && grep -rqs 'Unattended-Upgrade "1"' /etc/apt/apt.conf.d/ 2>/dev/null; then
    ok "Automatische Sicherheitsupdates (unattended-upgrades) sind aktiv."
  else
    warn "unattended-upgrades ist nicht installiert oder nicht aktiv — Sicherheitsupdates kommen nur manuell. ('apt install unattended-upgrades && dpkg-reconfigure -plow unattended-upgrades')"
  fi
else
  info "Kein apt gefunden — Update-Prüfung übersprungen."
fi

if [ -f /var/run/reboot-required ]; then
  warn "Neustart steht aus (/var/run/reboot-required) — installierte Updates sind erst danach aktiv."
else
  ok "Kein ausstehender Neustart gemeldet."
fi
UPTIME_D=$(( $(cut -d. -f1 /proc/uptime) / 86400 ))
if [ "$UPTIME_D" -gt "$MAX_UPTIME_D" ]; then
  warn "Läuft seit $UPTIME_D Tagen ohne Neustart — Kernel-Updates des Hosts greifen erst nach einem Neustart."
else
  info "Laufzeit seit letztem Start: $UPTIME_D Tage. Kernel: $(uname -r)"
fi

# ── 2. Lauschende Ports ──────────────────────────────────────────────────────
section "Netzwerk"
if have ss; then
  # Alles, was NICHT nur auf localhost lauscht (TCP + UDP).
  OPEN="$(ss -Hltnup 2>/dev/null | awk '{print $1, $5, $7}' \
    | grep -v -E ' (127\.[0-9.]+|\[::1\]):' || true)"
  UNEXPECTED=""
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    port="$(printf '%s' "$line" | awk '{print $2}' | sed -E 's/.*:([0-9]+)$/\1/')"
    case " $ALLOWED_PORTS " in
      *" $port "*) ;;
      *) UNEXPECTED="${UNEXPECTED}${line}"$'\n' ;;
    esac
  done <<< "$OPEN"
  if [ -n "$UNEXPECTED" ]; then
    warn "Dienste lauschen auf nicht erwarteten Ports (erlaubt: $ALLOWED_PORTS):"
    printf '%s' "$UNEXPECTED" | sort -u | sed 's/^/      /'
    printf '      %s\n' "→ Gewollt? Dann Port in ALLOWED_PORTS aufnehmen. Sonst Dienst abschalten oder an 127.0.0.1 binden."
  else
    ok "Nur erwartete Ports lauschen außerhalb von localhost ($ALLOWED_PORTS)."
  fi
else
  info "'ss' nicht gefunden — Port-Prüfung übersprungen."
fi

# ── 3. SSH ───────────────────────────────────────────────────────────────────
section "SSH"
if have sshd; then
  SSHD="$(sshd -T 2>/dev/null || true)"
  if [ -z "$SSHD" ]; then
    info "sshd-Konfiguration nicht lesbar (root nötig) — übersprungen."
  else
    get_sshd() { printf '%s\n' "$SSHD" | awk -v k="$1" '$1==k {print $2; exit}'; }
    PWAUTH="$(get_sshd passwordauthentication)"
    ROOTLOGIN="$(get_sshd permitrootlogin)"
    if [ "$PWAUTH" = "no" ]; then ok "SSH: Passwort-Anmeldung ist aus (nur Schlüssel)."
    else warn "SSH: Passwort-Anmeldung ist erlaubt (PasswordAuthentication $PWAUTH) — auf 'no' stellen und nur Schlüssel nutzen."; fi
    case "$ROOTLOGIN" in
      no|prohibit-password|without-password) ok "SSH: root-Login nur per Schlüssel oder aus ($ROOTLOGIN)." ;;
      *) warn "SSH: root darf sich mit Passwort anmelden (PermitRootLogin $ROOTLOGIN) — auf 'prohibit-password' stellen." ;;
    esac
  fi
  # Fehlgeschlagene Anmeldungen der letzten 7 Tage (nur Anzahl, keine Namen/IPs).
  if have journalctl; then
    FAILED_SSH="$(journalctl -u ssh -u sshd --since '7 days ago' --no-pager 2>/dev/null | grep -c -E 'Failed password|Invalid user' || true)"
    if [ "${FAILED_SSH:-0}" -gt 50 ]; then
      warn "SSH: $FAILED_SSH fehlgeschlagene Anmeldeversuche in 7 Tagen — ist Port 22 wirklich nur aus dem Heimnetz erreichbar?"
    else
      info "SSH: ${FAILED_SSH:-0} fehlgeschlagene Anmeldeversuche in 7 Tagen."
    fi
  fi
else
  info "Kein sshd installiert — übersprungen."
fi

# ── 4. Plattenplatz ──────────────────────────────────────────────────────────
section "Speicher"
while read -r pct mount; do
  n="${pct%\%}"
  [ -z "$n" ] && continue
  if [ "$n" -ge "$DISK_FAIL_PCT" ]; then fail "Dateisystem $mount ist zu $pct voll."
  elif [ "$n" -ge "$DISK_WARN_PCT" ]; then warn "Dateisystem $mount ist zu $pct voll."
  else ok "Dateisystem $mount: $pct belegt."
  fi
done < <(df -P -x tmpfs -x devtmpfs -x overlay -x squashfs 2>/dev/null | awk 'NR>1 {print $5, $6}' | sort -u)

# Ab hier nur noch für den App-Container.
if [ "$HOST_ROLE" != "proxmox" ]; then

# ── 5. Docker und Container ──────────────────────────────────────────────────
section "Docker"
if have docker; then
  info "Docker $(docker version --format '{{.Server.Version}}' 2>/dev/null || echo '?'), Compose $(docker compose version --short 2>/dev/null || echo '?')"
  if have apt-get; then
    DOCKER_UPD="$(apt-get -s -o Debug::NoLocking=true upgrade 2>/dev/null | grep -E '^Inst (docker|containerd)' | awk '{print $2}' | tr '\n' ' ' || true)"
    [ -n "$DOCKER_UPD" ] && warn "Docker-Updates stehen aus: $DOCKER_UPD"
  fi
  for svc in backend frontend; do
    NAME="$(docker ps -a --filter "label=com.docker.compose.service=$svc" --format '{{.Names}}' 2>/dev/null | head -1)"
    if [ -z "$NAME" ]; then fail "Container '$svc' existiert nicht."; continue; fi
    STATE="$(docker inspect -f '{{.State.Status}}' "$NAME" 2>/dev/null)"
    RESTARTS="$(docker inspect -f '{{.RestartCount}}' "$NAME" 2>/dev/null)"
    USERID="$(docker inspect -f '{{.Config.User}}' "$NAME" 2>/dev/null)"
    RO="$(docker inspect -f '{{.HostConfig.ReadonlyRootfs}}' "$NAME" 2>/dev/null)"
    PRIV="$(docker inspect -f '{{.HostConfig.Privileged}}' "$NAME" 2>/dev/null)"
    CREATED="$(docker inspect -f '{{.Created}}' "$NAME" 2>/dev/null | cut -dT -f1)"
    if [ "$STATE" = "running" ]; then ok "$svc läuft (Image-Stand $CREATED, Neustarts: $RESTARTS)."
    else fail "$svc läuft nicht (Status: $STATE)."; fi
    [ "${RESTARTS:-0}" -gt 3 ] && warn "$svc wurde $RESTARTS-mal automatisch neu gestartet — Logs prüfen: docker logs $NAME"
    [ "$PRIV" = "true" ] && fail "$svc läuft privilegiert."
    [ "$RO" = "true" ] || warn "$svc hat kein schreibgeschütztes Dateisystem (read_only fehlt)."
    if [ -z "$USERID" ] || [ "$USERID" = "0" ] || [ "$USERID" = "root" ]; then
      warn "$svc läuft im Container als root (kein USER im Image gesetzt)."
    fi
    # Alter des Images: lange kein Rebuild = Base-Image-Patches fehlen.
    if [ -n "$CREATED" ]; then
      AGE_D=$(( ($(date +%s) - $(date -d "$CREATED" +%s 2>/dev/null || date +%s)) / 86400 ))
      [ "$AGE_D" -gt 30 ] && warn "$svc-Container ist $AGE_D Tage alt — ein Rebuild holt aktuelle Base-Image-Patches ('deploy' baut nur geänderte Dienste)."
    fi
  done
  # Ports, die Docker auf ALLEN Interfaces veröffentlicht (außer den erlaubten).
  PUB="$(docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null | grep -E '0\.0\.0\.0:|\[::\]:' || true)"
  [ -n "$PUB" ] && info "Von Docker veröffentlichte Ports: $(printf '%s' "$PUB" | tr '\n' ';')"
  HTTP="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://localhost:80/api/health 2>/dev/null || echo 000)"
  if [ "$HTTP" = "200" ]; then ok "App antwortet lokal (/api/health 200)."
  else fail "App antwortet lokal nicht (/api/health → $HTTP)."; fi
else
  fail "Docker nicht gefunden."
fi

# ── 6. Tunnel, Runner, Dienste ───────────────────────────────────────────────
section "Dienste"
if have systemctl; then
  if systemctl is-active --quiet cloudflared 2>/dev/null; then ok "cloudflared (Tunnel) läuft."
  else fail "cloudflared (Tunnel) läuft nicht — die App ist von außen nicht erreichbar."; fi
  RUNNER="$(systemctl list-units --type=service --all --no-legend 'actions.runner.*' 2>/dev/null | awk '{print $1}' | head -1)"
  if [ -z "$RUNNER" ]; then info "Kein GitHub-Actions-Runner-Dienst gefunden."
  elif systemctl is-active --quiet "$RUNNER"; then ok "GitHub-Actions-Runner läuft ($RUNNER)."
  else warn "GitHub-Actions-Runner läuft nicht ($RUNNER) — Auto-Deploy und Trivy-Workflow fallen aus."; fi
  FAILED_UNITS="$(systemctl --failed --no-legend 2>/dev/null | awk '{print $1}' | tr '\n' ' ')"
  [ -n "$FAILED_UNITS" ] && warn "Fehlgeschlagene systemd-Dienste: $FAILED_UNITS"
fi

# ── 7. Zugangsdaten auf der Platte ───────────────────────────────────────────
section "Zugangsdaten"
SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
ENV_FILE="$(cd "$SCRIPT_DIR/.." && pwd)/.env"
if [ -f "$ENV_FILE" ]; then
  PERM="$(stat -c '%a' "$ENV_FILE")"
  OWNER="$(stat -c '%U' "$ENV_FILE")"
  if [ "$PERM" = "600" ] || [ "$PERM" = "400" ]; then ok ".env ist nur für $OWNER lesbar ($PERM)."
  else warn ".env hat Rechte $PERM (Besitzer $OWNER) — auf 600 setzen: chmod 600 $ENV_FILE"; fi
  # Nur prüfen, OB der Schalter gesetzt ist - niemals Werte ausgeben.
  if grep -q -E '^REGISTRATION_ENABLED=true' "$ENV_FILE"; then
    warn "Selbst-Registrierung ist eingeschaltet (REGISTRATION_ENABLED=true) — nach dem Anlegen neuer Konten wieder entfernen."
  else
    ok "Selbst-Registrierung ist aus."
  fi
else
  info ".env nicht gefunden unter $ENV_FILE."
fi

# ── 8. Backups ───────────────────────────────────────────────────────────────
section "Backups"
if [ -d "$BACKUP_DIR" ]; then
  LATEST="$(find "$BACKUP_DIR" -name 'haushalt-*.db.gz' -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1)"
  if [ -z "$LATEST" ]; then
    fail "Kein Backup in $BACKUP_DIR gefunden."
  else
    FILE="${LATEST#* }"
    AGE_H=$(( ($(date +%s) - $(printf '%s' "$LATEST" | cut -d. -f1)) / 3600 ))
    SIZE="$(stat -c '%s' "$FILE")"
    COUNT="$(find "$BACKUP_DIR" -name 'haushalt-*.db.gz' | wc -l)"
    if [ "$AGE_H" -gt "$BACKUP_MAX_AGE_H" ]; then fail "Letztes Backup ist $AGE_H h alt ($(basename "$FILE")) — läuft der Cron noch?"
    else ok "Letztes Backup ist $AGE_H h alt ($(basename "$FILE"), $COUNT Dateien vorhanden)."; fi
    [ "$SIZE" -lt 1024 ] && fail "Letztes Backup ist nur $SIZE Bytes groß — vermutlich leer/defekt."
    if have gzip && ! gzip -t "$FILE" 2>/dev/null; then fail "Letztes Backup ist beschädigt (gzip -t schlägt fehl)."; fi
  fi
  info "Hinweis: Dieser Check sieht nur die lokale Kopie. Die Auslagerung an den zweiten Ort prüft er nicht."
else
  fail "Backup-Verzeichnis $BACKUP_DIR existiert nicht."
fi

# ── 9. Trivy ─────────────────────────────────────────────────────────────────
section "Trivy"
if [ -f "$TRIVY_LOG" ]; then
  AGE_D=$(( ($(date +%s) - $(stat -c '%Y' "$TRIVY_LOG")) / 86400 ))
  if [ "$AGE_D" -gt "$TRIVY_MAX_AGE_D" ]; then warn "Trivy-Log ist $AGE_D Tage alt — läuft der wöchentliche Scan noch?"
  else ok "Trivy-Log ist $AGE_D Tage alt."; fi
else
  info "Kein Trivy-Log unter $TRIVY_LOG (läuft der Scan nur noch als GitHub-Workflow, ist das in Ordnung)."
fi

fi # Ende: nur App-Container

# ── Ergebnis ─────────────────────────────────────────────────────────────────
printf '\n%s\n' "Ergebnis: $FAIL Fehler, $WARN Warnungen."
[ "$FAIL" -gt 0 ] && exit 2
[ "$WARN" -gt 0 ] && exit 1
exit 0
