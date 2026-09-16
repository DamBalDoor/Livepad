#!/usr/bin/env bash
# Деплой DEV на VPS: pull → mysql → migrate → up приложений → health; при сбое — откат на .last-good-image-tag.
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/livepad}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.dev.yml}"
IMAGE_TAG="${IMAGE_TAG:-develop}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1/api/health}"
LAST_GOOD_FILE="${DEPLOY_DIR}/.last-good-image-tag"

cd "$DEPLOY_DIR"

rollback() {
  local prev="$1"
  echo "==> rollback: IMAGE_TAG=$prev" >&2
  export IMAGE_TAG="$prev"
  docker compose -f "$COMPOSE_FILE" pull
  docker compose -f "$COMPOSE_FILE" up -d --remove-orphans
}

echo "==> git fetch develop"
git fetch origin develop
git reset --hard "origin/develop"

PREVIOUS_GOOD="$(cat "$LAST_GOOD_FILE" 2>/dev/null || echo "develop")"
export IMAGE_TAG

if [ -n "${GHCR_TOKEN:-}" ]; then
  echo "==> docker login ghcr.io"
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "${GHCR_USER:-github}" --password-stdin
fi

echo "==> docker compose pull (IMAGE_TAG=$IMAGE_TAG)"
docker compose -f "$COMPOSE_FILE" pull

bash "$(dirname "$0")/wait-mysql-healthy.sh" "$COMPOSE_FILE"

echo "==> drizzle push (migrate profile)"
docker compose -f "$COMPOSE_FILE" --profile migrate run --rm migrate

echo "==> docker compose up (all services)"
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

echo "==> health check $HEALTH_URL"
health_ok=0
for _ in $(seq 1 30); do
  if curl -fsS "$HEALTH_URL" >/dev/null; then
    health_ok=1
    break
  fi
  sleep 2
done
if [ "$health_ok" -ne 1 ]; then
  echo "Health check failed — rolling back to $PREVIOUS_GOOD" >&2
  rollback "$PREVIOUS_GOOD"
  exit 1
fi

echo "$IMAGE_TAG" > "$LAST_GOOD_FILE"
echo "OK (recorded last-good tag: $IMAGE_TAG)"
