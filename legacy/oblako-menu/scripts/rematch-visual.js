require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { initDb, db } = require('../server/db');

initDb();

// Visual rematch from photo review (best unique shots → menu ids)
const VISUAL = {
  // Pasta
  'IMG_2712.jpg': 'pa0', // Фетучини Альфредо
  'IMG_2760.jpg': 'pa3', // Фетучини с медальонами
  // Mains
  'IMG_2716.jpg': 'm0',  // Страчетти из говядины
  'IMG_2730.jpg': 'hm6', // Медальоны из говядины
  // Salads
  'IMG_2780.jpg': 'sl8', // Салат с бурратой / рукола+сыр+бальзамик
  // Pizza
  'IMG_2800.jpg': 'p1',  // Маргарита
  // Desserts
  'IMG_3458.jpg': 'd1',  // Чизкейк классика
  'IMG_4504.jpg': 'd5',  // Тирамису
};

const foodCats = new Set([
  'Салаты', 'Закуски', 'Супы', 'Основные блюда', 'Хоспер меню',
  'Паста', 'Пицца', 'Гарниры', 'Десерты',
]);

const items = db.prepare(`
  SELECT mi.id, mi.name, c.name AS category_name
  FROM menu_items mi
  JOIN categories c ON c.id = mi.category_id
  WHERE mi.active = 1
`).all();

const byId = new Map(items.map(i => [i.id, i]));
const foodItems = items.filter(i => foodCats.has(i.category_name));

const optDir = path.join(process.cwd(), 'image', 'optimized');
const photos = fs.readdirSync(optDir).filter(f => f.endsWith('.jpg')).sort();

db.prepare('UPDATE menu_items SET image_path=NULL, image_source=NULL, match_confidence=NULL').run();
db.prepare('DELETE FROM image_matches').run();

const update = db.prepare(`
  UPDATE menu_items SET image_path=?, image_source=?, match_confidence=?, updated_at=datetime('now')
  WHERE id=?
`);
const insertMatch = db.prepare(`
  INSERT INTO image_matches (source_file, menu_item_id, confidence, method, vision_notes)
  VALUES (?, ?, ?, ?, ?)
`);

const usedItems = new Set();
const usedPhotos = new Set();
let assigned = 0;

// 1) Visual curated matches
for (const [file, itemId] of Object.entries(VISUAL)) {
  if (!photos.includes(file) || !byId.has(itemId) || usedItems.has(itemId)) continue;
  const pub = `/image/optimized/${file}`;
  update.run(pub, 'visual-review', 0.95, itemId);
  insertMatch.run(file, itemId, 0.95, 'visual-review', null);
  usedItems.add(itemId);
  usedPhotos.add(file);
  assigned++;
  console.log(`✓ ${file} → ${byId.get(itemId).name} (visual)`);
}

// 2) Remaining photos → remaining food items (one each)
const remainingPhotos = photos.filter(p => !usedPhotos.has(p));
const remainingFood = foodItems.filter(i => !usedItems.has(i.id));

for (let i = 0; i < Math.min(remainingPhotos.length, remainingFood.length); i++) {
  const file = remainingPhotos[i];
  const item = remainingFood[i];
  const pub = `/image/optimized/${file}`;
  update.run(pub, 'sequential-food', 0.35, item.id);
  insertMatch.run(file, item.id, 0.35, 'sequential-food', null);
  usedItems.add(item.id);
  usedPhotos.add(file);
  assigned++;
}

// Write image-map.js
const withImages = db.prepare(`
  SELECT id, image_path FROM menu_items
  WHERE image_path IS NOT NULL AND image_path != ''
`).all();

const mapLines = withImages.map(r => `  ${JSON.stringify(r.id)}: ${JSON.stringify(r.image_path)}`).join(',\n');
const mapJs = `/* Auto-generated — do not edit by hand */\nconst IMAGE_MAP = {\n${mapLines}\n};\n\nif (typeof MENU !== 'undefined') {\n  MENU.forEach(item => {\n    if (IMAGE_MAP[item.id]) item.image = IMAGE_MAP[item.id];\n  });\n}\n`;
fs.writeFileSync(path.join(process.cwd(), 'js', 'image-map.js'), mapJs, 'utf8');

console.log(`\nAssigned ${assigned} photos to food dishes.`);
console.log(`image-map.js: ${withImages.length} entries`);
console.log(`Food items with photos: ${usedItems.size}/${foodItems.length}`);
