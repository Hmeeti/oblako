#!/bin/sh
set -eu
ROOT="${BACKUP_ROOT:-/backups}"
STAMP=$(date +%Y%m%d-%H%M%S)
DIR="$ROOT/$STAMP"
mkdir -p "$DIR"

if [ -n "${DATABASE_URL:-}" ]; then
  pg_dump "$DATABASE_URL" > "$DIR/db.sql"
else
  echo "DATABASE_URL missing" >&2
  exit 1
fi

if [ -d /data/uploads ]; then
  tar -czf "$DIR/uploads.tar.gz" -C /data uploads || true
fi

# rotation: keep 14
ls -1dt "$ROOT"/* 2>/dev/null | tail -n +15 | xargs -r rm -rf
echo "Backup done: $DIR"
