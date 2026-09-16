#!/usr/bin/env bash
# Неинтерактивный drizzle push для Docker / CI (эквивалент pnpm db:push с --force).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
COMPOSE=(docker compose -f docker-compose.dev.yml)
"${COMPOSE[@]}" up -d mysql
if ! "${COMPOSE[@]}" wait mysql 2>/dev/null; then
  for _ in $(seq 1 60); do
    "${COMPOSE[@]}" ps mysql 2>/dev/null | grep -q "(healthy)" && break
    sleep 2
  done
fi
"${COMPOSE[@]}" --profile migrate run --rm migrate
