# Гибридный деплой OBLAKO

Гостевое меню → **GitHub Pages**  
Админка + API → **Railway**

Так админка работает в интернете, а меню остаётся быстрым на Pages.

---

## Схема

```
Гости  →  https://<user>.github.io/oblako/     (меню, фото, корзина)
Админ  →  https://<project>.up.railway.app/admin.html  (редактирование)
Меню на Pages подтягивает актуальные цены с Railway: /api/menu
```

---

## Шаг 1. Railway (админка + API)

1. Зайди на [railway.app](https://railway.app) и войди через GitHub.
2. **New Project → Deploy from GitHub repo → Hmeeti/oblako**.
3. Railway сам соберёт Node 22 и запустит `npm start`.
4. Открой сервис → **Settings → Networking → Generate Domain**.  
   Скопируй URL, например: `https://oblako-production-xxxx.up.railway.app`
5. В **Variables** добавь:

| Variable | Значение |
|---|---|
| `NODE_ENV` | `production` |
| `SESSION_SECRET` | любая длинная случайная строка |
| `ADMIN_USERNAME` | `hmeeti` |
| `ADMIN_PASSWORD_HASH` | хеш пароля (см. ниже) |
| `CORS_ORIGINS` | URL твоего GitHub Pages, например `https://hmeeti.github.io` |
| `DATABASE_PATH` | `data/oblako.db` |

### Как получить `ADMIN_PASSWORD_HASH`

Локально:

```bash
npm run hash-password -- "2289073"
```

Скопируй строку `$2b$12$...` в Railway Variable `ADMIN_PASSWORD_HASH`.

Можно сразу вставить этот хеш для пароля `2289073`:

```
$2b$12$rG/8mfkPEr.m00YRyVhAVeCNlU3Vt533Rkei9Uy2RB6YYrtgN8aMy
```

6. (Рекомендуется) **Settings → Volumes**: примонтируй volume в `/app/data`, чтобы база не стиралась при редеплое.  
   Тогда поставь `DATABASE_PATH=/app/data/oblako.db`.

7. Проверь:
   - `https://ТВОЙ-RAILWAY/api/health` → `{"ok":true,...}`
   - `https://ТВОЙ-RAILWAY/admin.html` → логин `hmeeti` / `2289073`

---

## Шаг 2. Прописать URL Railway в меню

Открой файл `js/config.js` в репозитории и вставь свой Railway URL:

```js
window.OBLAKO_CONFIG = {
  apiBase: 'https://ТВОЙ-ПРОЕКТ.up.railway.app',
  adminUrl: 'https://ТВОЙ-ПРОЕКТ.up.railway.app',
};
```

Закоммить и запушь в `main`.

---

## Шаг 3. GitHub Pages (гостевое меню)

1. Репозиторий → **Settings → Pages**.
2. **Source**: GitHub Actions.
3. Workflow `Deploy GitHub Pages` уже лежит в `.github/workflows/deploy-pages.yml` — после пуша в `main` он сам задеплоит меню.
4. Через 1–2 минуты меню будет на:
   `https://<твой-логин>.github.io/oblako/`

В **CORS_ORIGINS** на Railway укажи origin без пути:
`https://<твой-логин>.github.io`

Если репозиторий в организации/другом имени — подставь свой Pages URL.

---

## Шаг 4. Проверка

| Что | Где |
|---|---|
| Меню гостей | GitHub Pages |
| Кнопка «Админка» в футере | ведёт на Railway `/admin.html` |
| Логин админки | `hmeeti` / `2289073` |
| Изменения цен в админке | сразу видны на Pages (через `/api/menu`) |

---

## Важно

- **Админку открывай только с Railway-адреса**, не с Pages.
- Фото блюд лежат в репозитории (`image/dishes/`) и отдаются с Pages.
- Если загружаешь новое фото через админку на Railway — оно попадёт на диск Railway. Для Pages лучше класть фото в `image/dishes/` и пушить в GitHub.
- Без Volume база на Railway может сброситься после редеплоя (меню пересоздастся из `js/data.js` автоматически).

---

## Локальная разработка

Как раньше:

```bash
npm install
npm run setup
npm start
```

`js/config.js` → оставь `apiBase: ''` и `adminUrl: ''` для localhost.
