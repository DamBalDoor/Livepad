# Деплой DEV (Docker + GitHub Actions)

Стек для VPS в режиме production-like DEV: один публичный вход **HTTP :80**, MySQL только во внутренней сети Docker, образы собираются в GitHub Actions и публикуются в **GHCR** (экономия RAM на сервере ~2 GB).

Публичный DEV-сервер (сейчас): **http://46.20.106.34**

## Не трогать PM2 `tgloader`

На этом же хосте работает Telegram-бот **TGVideoLoader** (`pm2`, каталог `/root/TGVideoLoader`). Livepad:

- слушает только **Docker edge :80** (не конфликтует с ботом, у бота нет HTTP-портов);
- **не** останавливайте и не перезапускайте `pm2`-процесс `tgloader` при деплое Livepad;
- не занимайте системные сервисы, которые использует бот, без необходимости.

## Требования к серверу

- Ubuntu 24.04 (или аналог), Docker Engine + Compose plugin v2
- Рекомендуется **1–2 GB swap** (`fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile`)
- Каталог приложения: `/opt/livepad` (можно другой — тогда задайте `DEPLOY_DIR` в скрипте)
- Свободный порт **80** для `livepad-dev-edge`

## Первичная настройка VPS

```bash
# Docker (официальная инструкция Docker для Ubuntu) — установка выполняется на сервере отдельно

sudo mkdir -p /opt/livepad
sudo chown "$USER":"$USER" /opt/livepad
git clone https://github.com/DamBalDoor/Livepad.git /opt/livepad
cd /opt/livepad
git checkout develop

cp .env.example .env
# Отредактируйте .env (см. ниже)

# Однократный login в GHCR (read:packages) — PAT classic или fine-grained
echo "$YOUR_GITHUB_PAT" | docker login ghcr.io -u YOUR_GITHUB_USER --password-stdin
```

### `.env` на сервере

Минимум для `docker-compose.dev.yml`:

```env
BETTER_AUTH_SECRET=длинная-случайная-строка-не-из-репозитория
BETTER_AUTH_URL=http://46.20.106.34
WEB_ORIGIN=http://46.20.106.34
# Обязательны для compose (без дефолтов в docker-compose.dev.yml):
MYSQL_PASSWORD=livepad
MYSQL_ROOT_PASSWORD=livepad
IMAGE_TAG=develop
```

`DATABASE_URL` и `RUNNER_URL` в compose задаются автоматически для контейнеров (`mysql`, `runner`).

Первый запуск вручную (или дождитесь CI после настройки secrets):

```bash
cd /opt/livepad
export IMAGE_TAG=develop
docker compose -f docker-compose.dev.yml pull
docker compose -f docker-compose.dev.yml up -d
./scripts/db-push-docker.sh
curl -fsS http://127.0.0.1/api/health
```

Локальная сборка без GHCR:

```bash
docker compose -f docker-compose.dev.yml up -d --build
./scripts/db-push-docker.sh
```

## Маршрутизация (edge nginx)

| Путь | Назначение |
| --- | --- |
| `/` | Статика Vite (контейнер `web`) |
| `/api/*` | Fastify `:3001` |
| `/ws/*` | Runtime / integrity WebSocket → API |
| `/collab` | Hocuspocus Yjs → API `:1234` (same-origin, без отдельного :1234 снаружи) |

## CI/CD (ветка `develop`)

Workflow: [`.github/workflows/deploy-develop.yml`](../.github/workflows/deploy-develop.yml)

Job сборки задаёт заглушки `BETTER_AUTH_*` / `WEB_ORIGIN` только чтобы `docker compose` мог распарсить `docker-compose.dev.yml` ( `${VAR:?}` ); на VPS по-прежнему нужен настоящий `.env`.

1. Push / merge в `develop` → сборка образов `api`, `web`, `runner`, `migrate` → push в `ghcr.io/dambaldoor/livepad-*`
2. SSH на DEV → `scripts/deploy-dev.sh` (git reset, pull, up, drizzle push, health)

### Secrets в GitHub (Settings → Secrets → Actions)

| Secret | Назначение |
| --- | --- |
| `DEV_SSH_HOST` | `46.20.106.34` |
| `DEV_SSH_USER` | SSH-пользователь (например `root` или deploy-user) |
| `DEV_SSH_KEY` | Приватный ключ (PEM), **без** passphrase |
| `DEV_SSH_PORT` | Опционально, по умолчанию 22 |
| `DEV_GHCR_TOKEN` | PAT с `read:packages` для `docker pull` на сервере |

`GITHUB_TOKEN` в job сборки пушит пакеты в GHCR; для pull на VPS нужен отдельный PAT (`DEV_GHCR_TOKEN`).

Ручной деплой: вкладка Actions → **Deploy DEV (develop)** → **Run workflow**.

## Миграции БД

Интерактивный `pnpm db:push` не подходит для CD. В Docker используется:

```bash
pnpm exec drizzle-kit push --force
```

через сервис `migrate` (target `migrate` в `apps/api/Dockerfile`) или `./scripts/db-push-docker.sh`.

## Память

В `docker-compose.dev.yml` заданы лимиты и `--innodb-buffer-pool-size=64M`. При OOM увеличьте swap, не поднимайте лимиты MySQL без нужды.

## Откат деплоя

`scripts/deploy-dev.sh` хранит последний успешный тег в **`.last-good-image-tag`** (в каталоге репозитория на VPS). Порядок: pull → mysql healthy → migrate → `up -d` → health. Если health не прошёл, скрипт откатывает `IMAGE_TAG` на предыдущий good tag и снова делает `pull` + `up -d`.

## Backlog

- Запуск контейнеров от non-root `USER` (сейчас root в образах Node для простоты DEV).
