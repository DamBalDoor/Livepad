#!/usr/bin/env bash
# Ждём healthcheck MySQL. Не использовать `docker compose wait` — он ждёт остановки контейнера.
set -euo pipefail

COMPOSE_FILE="${1:-docker-compose.dev.yml}"
dc=(docker compose -f "$COMPOSE_FILE")

echo "==> mysql up --wait (healthy)"
if "${dc[@]}" up -d --wait mysql; then
  exit 0
fi

echo "==> compose --wait unavailable, polling Health.Status" >&2
"${dc[@]}" up -d mysql
cid="$("${dc[@]}" ps -q mysql | head -1)"
if [ -z "$cid" ]; then
  echo "MySQL container id not found" >&2
  exit 1
fi

status=""
for _ in $(seq 1 60); do
  status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$cid")"
  if [ "$status" = "healthy" ]; then
    exit 0
  fi
  sleep 2
done

echo "MySQL did not become healthy (last status: $status)" >&2
exit 1
