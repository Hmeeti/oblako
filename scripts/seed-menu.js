require('dotenv').config();
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { initDb, db } = require('../server/db');

initDb();

const dataPath = path.join(process.cwd(), 'js', 'data.js');
const code = fs.readFileSync(dataPath, 'utf8') + '\n;({ MENU, CATEGORY_ORDER });';
const { MENU, CATEGORY_ORDER } = vm.runInNewContext(code);

const existing = db.prepare('SELECT COUNT(*) AS c FROM menu_items').get().c;
if (existing > 0) {
  console.log(`Database already has ${existing} items. Skipping seed.`);
  console.log('To re-seed, delete data/oblako.db and run again.');
  process.exit(0);
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
    price_label, price2_label, volume, sort_order
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let orderByCat = {};
MENU.forEach(item => {
  if (!orderByCat[item.cat]) orderByCat[item.cat] = 0;
  const sortOrder = orderByCat[item.cat]++;

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
    sortOrder
  );
});

console.log(`Seeded ${MENU.length} menu items in ${CATEGORY_ORDER.length} categories.`);
