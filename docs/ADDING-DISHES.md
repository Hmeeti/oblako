# Добавление блюд и фото

## Гостевое меню (GitHub Pages)
1. Обнови `js/data.js` (или через админку на Render — она синхронизирует файлы).
2. Положи фото в `image/dishes/{id}.jpg` (id как у блюда: `sl0`, `m1`…).
3. Собери оптимизацию:
   ```bash
   npm run build:assets
   ```
   Это создаст:
   - `image/dishes/w400/{id}.webp` — карточки
   - `image/dishes/w800/{id}.webp` — просмотр
   - `data/menu.json` — быстрый кэш меню
4. Закоммить и запушь в `main`.

## Через админку (Render)
1. Открой `https://oblako-lppn.onrender.com/admin.html`
2. Войди → **Блюда** → изменить / добавить
3. Загрузи фото (кухня). Бар без фото-слотов.
4. При настроенном `GITHUB_TOKEN` изменения уходят в GitHub автоматически.

## object-position
В данных блюда можно задать кадрирование:
```js
{ id: 'sl0', ..., objectPosition: '50% 30%' }
```

## Оригиналы
Сырые JPG после `optimize-images` лежат в `image/originals/dishes/` (в git не коммитятся).
