#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/opt/backups/haushalts-app"
DB_PATH="/var/lib/docker/volumes/haushalts-app_db-data/_data/haushalt.db"
DATE=$(date +%Y-%m-%d)
KEEP_DAYS=21

mkdir -p "$BACKUP_DIR"

# Backup vor Deploy einspielen falls als Pre-Deploy-Hook genutzt
cp "$DB_PATH" "$BACKUP_DIR/haushalt-${DATE}.db"
gzip -f "$BACKUP_DIR/haushalt-${DATE}.db"

echo "[Backup] haushalt-${DATE}.db.gz gespeichert in $BACKUP_DIR"

# Alte Backups löschen
find "$BACKUP_DIR" -name "haushalt-*.db.gz" -mtime +${KEEP_DAYS} -delete
echo "[Backup] Backups älter als ${KEEP_DAYS} Tage bereinigt"
