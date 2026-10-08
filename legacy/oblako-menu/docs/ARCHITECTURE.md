# Архитектура Stolio

## Поверхности

1. **Публичный лендинг** `/` — продажа услуги, форма заявки.
2. **Кабинет студии** `/app/**` — PWA: заявки, проекты, редактор, QR, аналитика.
3. **Публичные меню** `/m/{slug}` — то, что открывает гость по QR.
4. **Короткие QR-ссылки** `/q/{code}` — 302 на меню + учёт скана.

## Стек

- Next.js App Router + TypeScript `strict`
- PostgreSQL + Prisma
- Auth: сессии в БД, cookie `httpOnly` + argon2id (см. `DECISIONS.md`)
- Tailwind + CSS-переменные бренд/темы меню
- `sharp` для картинок, `qrcode` + `pdf-lib` для QR
- Docker Compose: `app`, `postgres`, `caddy`, `backup`

## Границы доступа

- Единая функция `can(user, action, resource)` в `src/lib/auth/can.ts`.
- Репозитории в `src/server/repositories/*` принимают `projectId`.
- Прямой Prisma из клиентских компонентов запрещён.

## Реалтайм

- SSE `/api/events` для новых заявок в открытом кабинете.
- Telegram-бот (env) — опционально.

## Файлы

- Загрузки: `UPLOAD_ROOT` (`/data/uploads` в Docker) через `StorageProvider`.
- Демо-проекты помечены `demo: true`, удаляются `npm run db:clear-demo`.

## Наследие

Старое меню Oblako сохранено в `legacy/oblako-menu/` как источник seed Park Avenue.
