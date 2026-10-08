require('dotenv').config();
const { initDb, db } = require('../server/db');
initDb();
const rows = db.prepare(`
  SELECT mi.id, mi.name, mi.description, c.name AS cat
  FROM menu_items mi
  JOIN categories c ON c.id = mi.category_id
  WHERE mi.active = 1
  ORDER BY c.sort_order, mi.sort_order
`).all();
rows.forEach(r => {
  console.log([r.id, r.cat, r.name, r.description || ''].join('\t'));
});
