#!/usr/bin/env bash
# Ждём healthcheck MySQL. Не использовать `docker compose wait` / `up --wait`:
# на Compose v5 это зависает на уже running healthy сервисах.
set -euo pipefail

COMPOSE_FILE="${1:-docker-compose.dev.yml}"
dc=(docker compose -f "$COMPOSE_FILE")

echo "==> mysql up -d"
"${dc[@]}" up -d mysql

cid=""
for _ in $(seq 1 10); do
  cid="$("${dc[@]}" ps -q mysql | head -1 || true)"
  if [ -n "$cid" ]; then
    break
  fi
  sleep 1
done
if [ -z "$cid" ]; then
  echo "MySQL container id not found" >&2
  exit 1
fi

status=""
for _ in $(seq 1 60); do
  status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$cid")"
  echo "mysql health=$status"
  if [ "$status" = "healthy" ]; then
    exit 0
  fi
  sleep 2
done

echo "MySQL did not become healthy (last status: $status)" >&2
exit 1
