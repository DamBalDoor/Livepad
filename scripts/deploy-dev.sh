#!/usr/bin/env bash
# Деплой DEV на VPS: обновить код, подтянуть образы, поднять стек, миграция схемы, health-check.
# Запуск на сервере из каталога репозитория (по умолчанию /opt/livepad).
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/livepad}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.dev.yml}"
IMAGE_TAG="${IMAGE_TAG:-develop}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1/api/health}"

cd "$DEPLOY_DIR"

echo "==> git fetch develop"
git fetch origin develop
git reset --hard "origin/develop"

export IMAGE_TAG

if [ -n "${GHCR_TOKEN:-}" ]; then
  echo "==> docker login ghcr.io"
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "${GHCR_USER:-github}" --password-stdin
fi

echo "==> docker compose pull (IMAGE_TAG=$IMAGE_TAG)"
docker compose -f "$COMPOSE_FILE" pull

echo "==> docker compose up"
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

echo "==> drizzle push (migrate profile)"
docker compose -f "$COMPOSE_FILE" --profile migrate run --rm migrate

echo "==> health check $HEALTH_URL"
for i in $(seq 1 30); do
  if curl -fsS "$HEALTH_URL" >/dev/null; then
    echo "OK"
    exit 0
  fi
  sleep 2
done

echo "Health check failed" >&2
exit 1
