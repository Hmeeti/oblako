#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
git pull --ff-only
docker compose build app
docker compose run --rm app npx prisma migrate deploy
docker compose up -d app
echo "Deploy finished. Check /healthz"
