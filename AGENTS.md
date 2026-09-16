# Агенту: Livepad

Читай это в начале сессии. Детали запуска — в [README.md](./README.md). Жёсткие договорённости — в [`.cursor/rules/`](./.cursor/rules/). С пользователем отвечай по-русски.

## Продукт

Livepad — self-hosted коллаборативная IDE для live-coding интервью на Node.js. Интервьюер с аккаунтом создаёт комнату, кандидат входит по `/r/:slug?token=...` с отображаемым именем, без аккаунта.

Сейчас (см. также README §«Что уже есть»): invite + preflight «Прозрачность сессии»; Monaco + Yjs (Hocuspocus); Install / Run / **Stop**, общая консоль; чипы **Collab** и **Runner**; host-only «Кандидат» + баннер у гостя; rotate invite / завершить комнату; предупреждение **host_cookie**; тема **dark** по умолчанию, `light`/`dark` в `localStorage` (`livepad.theme`), без system / `prefers-color-scheme`.

Не сейчас: задания, таймер, автопроверка, чат, видео, LSP, TTY, Google, Piston, скрытый прокторинг, режим темы system.

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

Vite проксирует `/api`, `/ws` и `/collab` на API и Hocuspocus (`:3001` / `:1234`). Браузер открывает collab как same-origin `/collab` (см. `apps/web/src/lib/collab-url.ts`).

## Как работать

- Меняй контракт в `packages/shared`, потом web и api.
- UI и пользовательские строки — на русском.
- Не коммить `.env`, `.tools/`, `node_modules`.
- Не пиши эксплойты и скрытый сбор телеметрии.
- После UI-изменений проверяй в браузере хоста и гостя отдельно (гостю нужна сессия без cookie хоста).
- Не делай коммит и push, пока пользователь явно не попросил.
