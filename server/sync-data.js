const fs = require('fs');
const path = require('path');
const { db } = require('./db');

function escapeStr(s) {
  return String(s ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function syncMenuToDataJs() {
  const categories = db.prepare('SELECT name FROM categories ORDER BY sort_order, name').all();
  const items = db.prepare(`
    SELECT mi.*, c.name AS category_name
    FROM menu_items mi
    JOIN categories c ON c.id = mi.category_id
    WHERE mi.active = 1
    ORDER BY c.sort_order, mi.sort_order, mi.name
  `).all();

  const catList = categories.map(c => `  '${escapeStr(c.name)}'`).join(',\n');

  const itemBlocks = items.map(item => {
    const parts = [
      `id: '${escapeStr(item.id)}'`,
      `cat: '${escapeStr(item.category_name)}'`,
    ];
    if (item.subcat) parts.push(`subcat: '${escapeStr(item.subcat)}'`);
    parts.push(`name: '${escapeStr(item.name)}'`);
    parts.push(`price: ${Number(item.price)}`);
    if (item.price2 != null) parts.push(`price2: ${Number(item.price2)}`);
    if (item.price_label) parts.push(`priceLabel: '${escapeStr(item.price_label)}'`);
    if (item.price2_label) parts.push(`price2Label: '${escapeStr(item.price2_label)}'`);
    if (item.volume) parts.push(`volume: '${escapeStr(item.volume)}'`);
    if (item.description) parts.push(`desc: '${escapeStr(item.description)}'`);
    if (item.image_path) parts.push(`image: '${escapeStr(item.image_path)}'`);
    return `  { ${parts.join(', ')} }`;
  }).join(',\n');

  const content = `const CATEGORY_ORDER = [\n${catList}\n];\n\nconst MENU = [\n${itemBlocks}\n];\n\nMENU.forEach((item, idx) => {\n  item.uid = \`item-\${idx}\`;\n});\n`;

  fs.writeFileSync(path.join(process.cwd(), 'js', 'data.js'), content, 'utf8');

  // Also sync image-map.js
  const withImages = items.filter(i => i.image_path);
  const mapLines = withImages.map(r => `  ${JSON.stringify(r.id)}: ${JSON.stringify(r.image_path)}`).join(',\n');
  const mapJs = `/* Auto-synced from admin */\nconst IMAGE_MAP = {\n${mapLines}\n};\n\nif (typeof MENU !== 'undefined') {\n  MENU.forEach(item => {\n    if (IMAGE_MAP[item.id]) item.image = IMAGE_MAP[item.id];\n  });\n}\n`;
  fs.writeFileSync(path.join(process.cwd(), 'js', 'image-map.js'), mapJs, 'utf8');

  return { categories: categories.length, items: items.length };
}

module.exports = { syncMenuToDataJs };
