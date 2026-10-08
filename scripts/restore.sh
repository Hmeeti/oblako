#!/bin/sh
set -eu
SRC="${1:-}"
if [ -z "$SRC" ] || [ ! -d "$SRC" ]; then
  echo "Usage: restore.sh /backups/YYYYMMDD-HHMMSS" >&2
  exit 1
fi
if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL missing" >&2
  exit 1
fi
psql "$DATABASE_URL" < "$SRC/db.sql"
if [ -f "$SRC/uploads.tar.gz" ]; then
  tar -xzf "$SRC/uploads.tar.gz" -C /data
fi
echo "Restore complete from $SRC"
echo "Проверьте сайт на тестовой копии перед продом."
