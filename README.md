# Livepad

Онлайн-IDE для live-coding интервью: общая комната, несколько файлов, npm и запуск Node.js.

## Что нужно

- Node.js 20+
- pnpm (`corepack enable`)
- Docker Desktop — MySQL в compose и песочница запуска (предпочтительно)

Если Docker ещё нет: MySQL можно поднять портативным MariaDB (скрипт ниже), а Run пойдёт локально с таймаутом, пока не появится Docker.

## Запуск

```bash
cp .env.example .env
pnpm install
```

База:

```bash
docker compose up -d mysql
# или без Docker:
powershell -File scripts/start-mysql.ps1
```

Схема и dev-серверы:

```bash
pnpm db:push
pnpm dev
```

- Web: http://localhost:5173
- API: http://localhost:3001
- Collab WS: ws://localhost:1234
- Runner: http://localhost:4000

Интервьюер регистрируется, создаёт комнату и копирует ссылку кандидату. Кандидат открывает ссылку, вводит имя и видит тот же код в реальном времени.

Кнопки **Install** (`npm install --ignore-scripts`) и **Run** (`node`). С Docker запуск идёт в контейнере без сети; без Docker — локально, только для разработки.
