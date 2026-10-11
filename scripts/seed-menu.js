require('dotenv').config();
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { initDb, db } = require('../server/db');

initDb();

const force = process.argv.includes('--force') || process.env.FORCE_RESEED === '1';

const dataPath = path.join(process.cwd(), 'js', 'data.js');
const code = fs.readFileSync(dataPath, 'utf8') + '\n;({ MENU, CATEGORY_ORDER, MENU_REVISION });';
const { MENU, CATEGORY_ORDER, MENU_REVISION } = vm.runInNewContext(code);

let IMAGE_MAP = {};
try {
  const mapCode = fs.readFileSync(path.join(process.cwd(), 'js', 'image-map.js'), 'utf8') + '\n; IMAGE_MAP;';
  IMAGE_MAP = vm.runInNewContext(mapCode, {}) || {};
} catch (_) { /* optional */ }

db.exec(`
  CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

const existing = db.prepare('SELECT COUNT(*) AS c FROM menu_items').get().c;
const currentRev = db.prepare('SELECT value FROM app_meta WHERE key = ?').get('menu_revision')?.value;

if (existing > 0 && !force) {
  console.log(`Database already has ${existing} items (rev=${currentRev || 'none'}). Skipping seed.`);
  console.log('To re-seed: node scripts/seed-menu.js --force');
  process.exit(0);
}

if (force && existing > 0) {
  console.log(`Force reseed: clearing ${existing} items (was rev=${currentRev || 'none'})…`);
  db.exec('DELETE FROM menu_items; DELETE FROM categories;');
}

const insertCat = db.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)');
const getCat = db.prepare('SELECT id FROM categories WHERE name = ?');

const catMap = {};
CATEGORY_ORDER.forEach((name, idx) => {
  insertCat.run(name, idx);
  catMap[name] = getCat.get(name).id;
});

const insertItem = db.prepare(`
  INSERT INTO menu_items (
    id, category_id, subcat, name, description, price, price2,
    price_label, price2_label, volume, image_path, image_source, match_confidence, sort_order
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const BAR = new Set(['Кофе и чай', 'Безалкогольные', 'Алкогольные']);
let orderByCat = {};
let withImages = 0;

MENU.forEach(item => {
  if (!orderByCat[item.cat]) orderByCat[item.cat] = 0;
  const sortOrder = orderByCat[item.cat]++;

  const photoKey = item.photoId || item.id;
  let image = item.image || IMAGE_MAP[photoKey] || IMAGE_MAP[item.id] || null;
  let imageSource = image ? (item.image ? 'seed' : 'image-map') : null;

  if (!BAR.has(item.cat)) {
    const w400 = `image/dishes/w400/${photoKey}.webp`;
    if (fs.existsSync(path.join(process.cwd(), w400))) {
      image = w400;
      imageSource = 'webp';
    } else {
      const dish = path.join(process.cwd(), 'image', 'dishes', `${photoKey}.jpg`);
      if (fs.existsSync(dish)) {
        image = `image/dishes/${photoKey}.jpg`;
        imageSource = 'dishes';
      }
    }
  }

  if (image) withImages++;

  insertItem.run(
    item.id,
    catMap[item.cat],
    item.subcat || null,
    item.name,
    item.desc || null,
    item.price ?? null,
    item.price2 ?? null,
    item.priceLabel || null,
    item.price2Label || null,
    item.volume || null,
    image,
    imageSource,
    image ? 1 : null,
    sortOrder
  );
});

db.prepare(`
  INSERT INTO app_meta (key, value) VALUES ('menu_revision', ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`).run(MENU_REVISION || 'unknown');

console.log(
  `Seeded ${MENU.length} menu items in ${CATEGORY_ORDER.length} categories ` +
  `(${withImages} with photos, rev=${MENU_REVISION}).`
);
