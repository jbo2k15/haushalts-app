#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

BACKUP_DIR="/opt/backups/haushalts-app"
DB_PATH="/var/lib/docker/volumes/haushalts-app_db-data/_data/haushalt.db"
DATE=$(date +%Y-%m-%d)
KEEP_DAYS=21

mkdir -p "$BACKUP_DIR"

# WAL-Checkpoint vor dem Kopieren: journal_mode=WAL (siehe backend/src/index.js)
# haelt frisch committete Schreibvorgaenge teils nur im -wal-Sidecar, nicht in
# der Hauptdatei - ein rohes cp der Hauptdatei waere dann inkonsistent
# (juengste Aenderungen fehlten). wal_checkpoint(TRUNCATE) schreibt den
# gesamten WAL-Inhalt zurueck in die Hauptdatei und leert den Sidecar. Laeuft
# ueber den laufenden Backend-Container (better-sqlite3 ist dort bereits
# Dependency, kein zusaetzliches Host-Tool noetig). Best-effort: schlaegt es
# fehl (z.B. Container gerade nicht oben), wird trotzdem normal weiter
# gesichert - ein evtl. um Sekunden verzoegertes Backup ist besser als keins.
if ! docker compose exec -T backend node --input-type=module -e "
import Database from 'better-sqlite3';
const db = new Database(process.env.DATABASE_URL.replace('file:', ''));
db.pragma('wal_checkpoint(TRUNCATE)');
db.close();
" >/tmp/haushalts-backup-checkpoint.log 2>&1; then
  echo "[Backup] WARNUNG: WAL-Checkpoint fehlgeschlagen (Backend-Container nicht erreichbar?) - sichere trotzdem" >&2
  cat /tmp/haushalts-backup-checkpoint.log >&2 || true
fi

# Backup vor Deploy einspielen falls als Pre-Deploy-Hook genutzt
cp "$DB_PATH" "$BACKUP_DIR/haushalt-${DATE}.db"
gzip -f "$BACKUP_DIR/haushalt-${DATE}.db"

echo "[Backup] haushalt-${DATE}.db.gz gespeichert in $BACKUP_DIR"

# Alte Backups löschen
find "$BACKUP_DIR" -name "haushalt-*.db.gz" -mtime +${KEEP_DAYS} -delete
echo "[Backup] Backups älter als ${KEEP_DAYS} Tage bereinigt"
