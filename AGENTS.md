# Агенту: Livepad

Читай это в начале сессии. Детали запуска — в [README.md](./README.md). Жёсткие договорённости — в [`.cursor/rules/`](./.cursor/rules/). С пользователем отвечай по-русски.

## Продукт

Livepad — self-hosted коллаборативная IDE для live-coding интервью на Node.js. Интервьюер с аккаунтом создаёт комнату, кандидат входит по `/r/:slug?token=...` с отображаемым именем, без аккаунта.

Сейчас: комнаты, Monaco + Yjs, npm/node, общая консоль, host-only панель целостности с явным предупреждением кандидату.

Не сейчас: задания, таймер, автопроверка, чат, видео, LSP, TTY, Google, Piston, скрытый прокторинг.

## Куда смотреть

| Задача | Файлы |
| --- | --- |
| Страницы и IDE | `apps/web/src/pages/`, `RoomPage.tsx` |
| Типы API/событий | `packages/shared/src/index.ts` |
| HTTP, auth, WS run/integrity | `apps/api/src/` |
| Схема БД | `apps/api/src/db/schema.ts` |
| Yjs persist | `apps/api/src/collab.ts` |
| Docker / local run | `apps/runner/src/docker.ts` |
| Env | `.env.example`, `apps/api/src/env.ts` |

Vite проксирует `/api` и `/ws` на `:3001`. Hocuspocus — **отдельный** порт `:1234`, клиент ходит туда напрямую.

## Как работать

- Меняй контракт в `packages/shared`, потом web и api.
- UI и пользовательские строки — на русском.
- Не коммить `.env`, `.tools/`, `node_modules`.
- Не пиши эксплойты и скрытый сбор телеметрии.
- После UI-изменений проверяй в браузере хоста и гостя отдельно (гостю нужна сессия без cookie хоста).
- Не делай коммит и push, пока пользователь явно не попросил.
