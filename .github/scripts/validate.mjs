// Pre-deploy check: data files are valid and every referenced file exists.
// Any error → exit 1 → the deploy job is skipped and the live site stays as it was.
import { readFileSync, existsSync } from 'node:fs';

const errors = [];
const fail = (msg) => errors.push(msg);

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    fail(`${path}: невалидный JSON — ${err.message}`);
    return null;
  }
}

const isPrice = (v) => v == null || (Number.isInteger(v) && v >= 0);

/* ---------- data/menu.json ---------- */
const menu = readJson('data/menu.json');
if (menu) {
  if (!Array.isArray(menu.categories) || !Array.isArray(menu.items)) {
    fail('data/menu.json: нужны массивы categories и items');
  } else {
    const cats = new Set();
    menu.categories.forEach((c, i) => {
      if (!c?.name?.trim()) fail(`categories[${i}]: пустое название`);
      if (cats.has(c.name)) fail(`categories: раздел «${c.name}» повторяется`);
      cats.add(c.name);
    });

    const ids = new Set();
    menu.items.forEach((item, i) => {
      const where = `items[${i}] «${item?.name ?? '?'}»`;
      if (!item?.id) fail(`${where}: нет id`);
      if (ids.has(item.id)) fail(`${where}: id ${item.id} повторяется`);
      ids.add(item.id);
      if (!item.name?.trim()) fail(`${where}: пустое название`);
      if (!cats.has(item.cat)) fail(`${where}: раздел «${item.cat}» не существует`);
      if (!isPrice(item.price) || !isPrice(item.price2)) fail(`${where}: цена должна быть целым числом`);
      if (item.badge && !['new', 'hit'].includes(item.badge)) fail(`${where}: неизвестная метка ${item.badge}`);
      if (item.photo) {
        ['w400', 'w800'].forEach(size => {
          const file = `image/dishes/${size}/${item.photo}`;
          if (!existsSync(file)) fail(`${where}: нет файла ${file}`);
        });
      }
    });
  }
}

/* ---------- data/site.json ---------- */
const site = readJson('data/site.json');
if (site) {
  if (typeof site.contacts !== 'object') fail('data/site.json: нет блока contacts');
  if (!Array.isArray(site.rules?.sections)) fail('data/site.json: нет rules.sections');
  if (!Array.isArray(site.promos)) fail('data/site.json: promos должен быть массивом');
  if (!Number.isInteger(site.servicePercent)) fail('data/site.json: servicePercent должен быть числом');
}

/* ---------- local links in pages ---------- */
for (const page of ['index.html', 'admin/index.html']) {
  const dir = page.includes('/') ? page.slice(0, page.lastIndexOf('/') + 1) : '';
  const html = readFileSync(page, 'utf8');
  for (const [, ref] of html.matchAll(/(?:src|href)="([^"#:]+?)(?:\?[^"]*)?"/g)) {
    if (ref === './' || ref === '../') continue;
    const path = new URL(ref, `file:///${dir}`).pathname.slice(1);
    if (!existsSync(path)) fail(`${page}: битая ссылка ${ref}`);
  }
}

if (errors.length) {
  console.error(`Найдено ошибок: ${errors.length}\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`OK: ${menu.items.length} блюд, ${menu.categories.length} разделов, ссылки на месте`);
