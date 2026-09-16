#!/usr/bin/env bash
# Неинтерактивный drizzle push для Docker / CI (эквивалент pnpm db:push с --force).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
COMPOSE=(docker compose -f docker-compose.dev.yml)
"${COMPOSE[@]}" --profile migrate run --rm migrate
