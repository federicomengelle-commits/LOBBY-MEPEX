#!/usr/bin/env bash
# =============================================
# MEPEX — Backup nocturno de Supabase (pg_dump)
# =============================================
# Corre en el VPS. Dump completo del schema public con rotación de 30 días.
#
# SETUP (una vez):
#   1. Instalar cliente postgres 15+:  apt install postgresql-client
#   2. Crear /root/.mepex_db_url con el connection string de Supabase
#      (Dashboard → Settings → Database → Connection string URI, usar el
#      "Session pooler" si la red del VPS es IPv4-only):
#        postgresql://postgres.<ref>:<PASSWORD>@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
#      chmod 600 /root/.mepex_db_url
#   3. mkdir -p /root/backups-mepex
#   4. Probar a mano:  bash backup-supabase.sh
#   5. Cron (02:30 todas las noches):
#        crontab -e
#        30 2 * * * /bin/bash /root/backup-supabase.sh >> /root/backups-mepex/backup.log 2>&1
# =============================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/root/backups-mepex}"
DB_URL_FILE="${DB_URL_FILE:-/root/.mepex_db_url}"
KEEP_DAYS=30

DB_URL=$(cat "$DB_URL_FILE")
STAMP=$(date +%Y%m%d_%H%M)
OUT="$BACKUP_DIR/mepex_$STAMP.dump"

echo "[$(date '+%F %T')] backup → $OUT"
pg_dump "$DB_URL" --schema=public --format=custom --no-owner --no-privileges --file="$OUT"
echo "[$(date '+%F %T')] OK ($(du -h "$OUT" | cut -f1))"

# Rotación
find "$BACKUP_DIR" -name "mepex_*.dump" -mtime +$KEEP_DAYS -delete
echo "[$(date '+%F %T')] rotación: quedan $(ls "$BACKUP_DIR"/mepex_*.dump 2>/dev/null | wc -l) dumps"

# Restaurar (referencia):
#   pg_restore --clean --if-exists -d "$DB_URL" mepex_YYYYMMDD_HHMM.dump
# Restaurar UNA tabla:
#   pg_restore -d "$DB_URL" --table=nombre_tabla mepex_YYYYMMDD_HHMM.dump
