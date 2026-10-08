# Stolio — платформа электронных QR-меню

Один сервер: лендинг, кабинет студии (PWA) и публичные меню заведений.

> **Владельцу:** перед рекламой проверьте свободу домена (`.kz` / `.com` / `.app`) и товарного знака **Stolio**. Название читается как «Сто́лио» на RU/KK/EN.

## Быстрый старт (локально)

1. Установите Docker и Node.js 22+.
2. Скопируйте env: `cp .env.example .env`
3. Поднимите Postgres: `docker compose -f docker-compose.dev.yml up -d`
4. Установите зависимости: `npm install --legacy-peer-deps`
5. Миграции: `npx prisma migrate dev --name init`
6. Сид (админ + Park Avenue): `npm run db:seed`
7. Запуск: `npm run dev` → http://localhost:3000

Логин по умолчанию: `admin@stolio.local` / `ChangeMeNow123!` — **смените сразу**.

Демо-меню: `/m/park-avenue`. Удалить демо: `npm run db:clear-demo`.

## Деплой на VPS (простым языком)

Рекомендуем **VPS в Казахстане**: по закону РК о персональных данных базы с данными граждан РК лучше держать на серверах в РК. **Согласовать с юристом.**

1. Арендуйте VPS (Ubuntu 22.04/24.04).
2. Установите Docker: https://docs.docker.com/engine/install/ubuntu/
3. Направьте домен A-записью на IP сервера.
4. Скопируйте проект на сервер (`git clone` …).
5. Заполните `.env` (пароль БД, домен, контакты, Telegram).
6. Запуск: `docker compose --profile prod up -d --build`
7. Миграции: `docker compose run --rm app npx prisma migrate deploy`
8. Админ: `docker compose run --rm app npm run admin:create`
9. Откройте сайт и проверьте `/healthz`.

Обновление: `scripts/deploy.sh`  
Бэкап: `scripts/backup.sh` (ротация 14 копий)  
Восстановление: `scripts/restore.sh /backups/...` (сначала на тестовой копии).

### Если сайт упал

1. `docker compose ps` — какие контейнеры живы.
2. `docker compose logs app --tail=200` — ошибки приложения.
3. Проверьте `/healthz`.
4. При необходимости восстановите последний бэкап на **тестовой** машине, затем на проде.

## Команды качества

```bash
npm run typecheck
npm run lint
npm run test
npm run e2e   # нужен Playwright + поднятый сервер
```

## Документы

- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/DATA_MODEL.md`
- `PROJECT_STATE.md`

## TODO от владельца

- Контакты студии (телефон, WhatsApp, Telegram, email)
- Домен и DNS
- Токен Telegram-бота + chat id
- Тарифы для лендинга (или оставить «по запросу»)
- Юридические тексты политики (сейчас черновик-заглушка)
- Согласие клиентов на публикацию кейсов
