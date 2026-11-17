# OBLAKO Lounge Bar — электронное меню

Сайт: https://hmeeti.github.io/oblako/
Админка: https://hmeeti.github.io/oblako/admin/ (не индексируется, ссылок на неё на сайте нет)

## Как устроено

Статический сайт на GitHub Pages без сервера и сборки.

| Что | Где |
|---|---|
| Меню: разделы, блюда, цены, составы, фото, стоп-лист, метки | `data/menu.json` |
| Контакты, текст на главной, акции, правила, % обслуживания | `data/site.json` |
| Фото блюд (карточка / просмотр) | `image/dishes/w400/`, `image/dishes/w800/` |
| Публичный сайт | `index.html`, `css/`, `js/` |
| Админка | `admin/` (`auth.json` — только соль и хеш пароля) |
| Проверка и публикация | `.github/workflows/deploy-pages.yml`, `.github/scripts/validate.mjs` |

Админка сохраняет изменения коммитом в `main` через GitHub API. Каждый коммит запускает
GitHub Actions: сначала проверка JSON и ссылок на фото, затем публикация. Если проверка
не прошла, сайт остаётся прежним.

## Ключ GitHub для админки (один раз на каждом телефоне)

1. Открыть https://github.com/settings/personal-access-tokens/new (вход в аккаунт Hmeeti).
2. Token name: `oblako-admin`, Expiration: максимальный срок.
3. Repository access → **Only select repositories** → `Hmeeti/oblako`.
4. Permissions → Repository permissions → **Contents: Read and write** → **Generate token**.
5. Скопировать ключ `github_pat_…`, открыть админку, ввести логин, пароль и ключ → «Войти».

Ключ хранится только в этом браузере, зашифрованный паролем админки. В репозиторий он не попадает.
Когда ключ истечёт, админка скажет об этом — создайте новый по тем же шагам.

## Откат

- Последнее изменение из админки: вкладка «История» → «Отменить последнее изменение».
- Полный откат сайта к состоянию до обновления от 17.11.2026:
  `git revert --no-edit backup-before-update-20261117..main && git push`

## Локальный просмотр

```bash
python3 -m http.server 8000   # затем http://localhost:8000/
```
