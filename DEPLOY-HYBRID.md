# Гибридный деплой OBLAKO

Гостевое меню → **GitHub Pages**  
Админка + API → **Render**

Так админка работает в интернете, а меню остаётся быстрым на Pages.

---

## Схема

```
Гости  →  https://<user>.github.io/oblako/        (меню, фото, корзина)
Админ  →  https://oblako-xxxx.onrender.com/admin.html
Меню на Pages берёт актуальные цены с Render: /api/menu
```

---

## Шаг 1. Render (админка + API)

1. Зайди на [render.com](https://render.com) и войди через GitHub.
2. **New → Blueprint** (или **Web Service**) → выбери репозиторий `Hmeeti/oblako`.
3. Если через Blueprint — подхватится файл `render.yaml` из репо.
4. Если вручную **Web Service**:
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance type:** Free
5. В **Environment** добавь переменные:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `NODE_VERSION` | `22` |
| `SESSION_SECRET` | любая длинная случайная строка |
| `ADMIN_USERNAME` | `hmeeti` |
| `ADMIN_PASSWORD_HASH` | см. ниже |
| `CORS_ORIGINS` | `https://hmeeti.github.io` |
| `DATABASE_PATH` | `data/oblako.db` |

### `ADMIN_PASSWORD_HASH` для пароля `9987650`

Вставь как есть:

```
$2b$12$ZSqP57ac22kXwje7LvOYEub07Dr0iQFlUre2EL7mZzzH7dXwoJ18m
```

Или сгенерируй локально:

```bash
npm run hash-password -- "9987650"
```

6. Нажми **Deploy**. Дождись статуса **Live**.
7. Скопируй URL сервиса, например:  
   `https://oblako-xxxx.onrender.com`

8. Проверь:
   - `https://ТВОЙ-URL/api/health` → `{"ok":true,...}`
   - `https://ТВОЙ-URL/admin.html` → логин **hmeeti** / **9987650**

> На бесплатном плане Render «засыпает» без трафика ~15 мин. Первый вход после паузы может подождать 30–60 сек.

---

## Шаг 2. Прописать URL Render в меню

Открой `js/config.js` и вставь свой URL:

```js
window.OBLAKO_CONFIG = {
  apiBase: 'https://oblako-xxxx.onrender.com',
  adminUrl: 'https://oblako-xxxx.onrender.com',
};
```

Закоммить и запушь в `main`  
(или пришли URL — можно прописать за тебя).

---

## Шаг 3. GitHub Pages (гостевое меню)

1. Репозиторий → **Settings → Pages**.
2. **Source**: GitHub Actions.
3. Workflow уже есть: `.github/workflows/deploy-pages.yml`.
4. После пуша в `main` меню появится на:  
   `https://<твой-логин>.github.io/oblako/`

В `CORS_ORIGINS` на Render укажи origin **без пути**:
`https://<твой-логин>.github.io`

---

## Шаг 4. Проверка

| Что | Где |
|---|---|
| Меню гостей | GitHub Pages |
| Кнопка «Админка» в футере | ведёт на Render `/admin.html` |
| Логин | `hmeeti` / `9987650` |
| Правки цен в админке | видны на Pages через `/api/menu` |

---

## Важно

- Админку открывай **только с адреса Render**, не с Pages.
- Фото лежат в репо (`image/dishes/`) и отдаются с Pages.
- На Free-плане диск эфемерный: после редеплоя база может сброситься и заново засеется из `js/data.js`. Для постоянных правок лучше потом пушить обновлённое меню в GitHub.
- Первый запрос после «сна» Render бывает медленным — это нормально для free.

---

## Локально

```bash
npm install
npm run setup
npm start
```

В `js/config.js` для localhost оставь:

```js
apiBase: '',
adminUrl: '',
```
