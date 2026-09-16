#!/usr/bin/env bash
# Неинтерактивный drizzle push для Docker / CI (эквивалент pnpm db:push с --force).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
COMPOSE_FILE=docker-compose.dev.yml
bash "$ROOT/scripts/wait-mysql-healthy.sh" "$COMPOSE_FILE"
docker compose -f "$COMPOSE_FILE" --profile migrate run --rm migrate
