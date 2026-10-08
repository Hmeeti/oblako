# PROJECT_STATE — Stolio

## Сделано (Фаза 0 + Фаза 1, первый проход)

- [x] Next.js App Router + TS strict + Tailwind + бренд-токены
- [x] Prisma-схема + миграции (init)
- [x] Docker Compose (dev/prod профили), Caddyfile, backup/restore/deploy скрипты
- [x] Auth: argon2id + httpOnly session cookie + rate limit логина
- [x] `can()` + роли studio_admin / project_owner / project_editor
- [x] `brand.ts`, SVG/PNG бренд-комплект в `public/brand/`
- [x] i18n-словари RU/KK/EN (базовые ключи)
- [x] Лендинг + форма заявки (honeypot, rate limit, Telegram optional, SSE hook)
- [x] Кабинет `/app`: заявки, проекты, редактор, стоп-лист, QR (PDF/ZIP), аналитика
- [x] Публичное меню `/m/{slug}` + счёт-калькулятор + 3 темы
- [x] QR редирект `/q/{code}` со счётчиком
- [x] Seed Park Avenue (`demo: true`) из `seed/parkavenue/menu.json`
- [x] Документы: ARCHITECTURE, DECISIONS, DATA_MODEL, README
- [x] Vitest: `can()` изоляция ролей
- [x] Legacy Oblako перенесён в `legacy/oblako-menu/`

## В процессе / ограничения текущего прохода

- [ ] Полноценный dnd-kit drag (есть ↑↓), кадрирование фото 4:3, LQIP
- [ ] Импорт CSV UI (шаблон есть) — загрузчик минимальный TODO
- [ ] Password reset UI (модель готова)
- [ ] Service worker кабинета + install banner (manifest есть)
- [ ] Playwright e2e на iPhone/Android эмуляции
- [ ] Lighthouse прогон ≥95/90 — нужен поднятый стенд
- [ ] pg-boss воркеры картинок (интерфейс Storage готов, очередь TODO)
- [ ] Миграция на better-auth при стабилизации peer deps

## Дальше (не начинать без команды)

- Фаза 2: клиентский кабинет, AI-импорт, кастомные домены, Web Push, 2FA…
- Фаза 3: оплата, white-label…

## Известные проблемы

- Контакты студии / домен / тарифы / юридические тексты — `TODO` у владельца.
- Фото блюд Park Avenue в seed не копируются автоматически из legacy (пути старые); меню текстовое + цены.
- SSE в serverless/multi-instance не шарит listeners между процессами — ок для одного контейнера.

## Команды

```bash
cp .env.example .env
docker compose -f docker-compose.dev.yml up -d
npm install --legacy-peer-deps
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

Админ по умолчанию: `admin@stolio.local` / `ChangeMeNow123!` (сменить!).

## PR

https://github.com/Hmeeti/oblako/pull/2
