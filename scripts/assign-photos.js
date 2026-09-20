/**
 * Assign best dish photos to the current kitchen menu.
 * Writes js/image-map.js and copies assigned JPEGs to image/dishes/{id}.jpg
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { initDb, db } = require('../server/db');

initDb();

// Curated visual matches: best photo → current menu item id
// (re-mapped after kitchen menu update)
const CURATED = {
  // Pasta
  'IMG_2712.jpg': 'pa0', // Фетучини Альфредо
  'IMG_2760.jpg': 'pa3', // Фетучини с медальонами (pasta + medallions)

  // Mains
  'IMG_2716.jpg': 'm0',  // Телятина с грибами в сливочном соусе
  'IMG_2750.jpg': 'm1',  // Куриное филе на гриле
  'IMG_2739.jpg': 'm5',  // Курица по-тайски

  // Salads
  'IMG_4534.jpg': 'sl0', // Руккола с креветками
  'IMG_4545.jpg': 'sl1', // Цезарь с курицей
  'IMG_4548.jpg': 'sl2', // Цезарь с креветками
  'IMG_4553.jpg': 'sl3', // Цезарь с сёмгой
  'IMG_2785.jpg': 'sl5', // Салат с бурратой
  'IMG_2780.jpg': 'sl6', // Хрустящий баклажан
  'IMG_2778.jpg': 'sl7', // Греческий / руккола+фета+томаты

  // Pizza
  'IMG_2796.jpg': 'p0',  // Пепперони
  'IMG_2800.jpg': 'p1',  // Маргарита

  // Desserts
  'IMG_3487.jpg': 'd0',  // Чизкейк испанский
  'IMG_3458.jpg': 'd1',  // Чизкейк классика
  'IMG_3494.jpg': 'd4',  // Мороженое / вафли с мороженым (closest)
  'IMG_3468.jpg': 'd2',  // Фруктовая подача / ягодный десерт
  'IMG_4504.jpg': 'd3',  // Шоколад (тирамису с какао — ближайшее)

  // Soups
  'IMG_4524.jpg': 's2',  // Том-ям

  // Shashlik / meat boards
  'IMG_2765.jpg': 'hm6', // Говяжьи рёбра от шефа
};

const foodCats = new Set([
  'Салаты', 'Закуски', 'Супы', 'Основные блюда', 'Хоспер меню',
  'Паста', 'Пицца', 'Десерты', 'Кавказские шашлыки', 'Роллы',
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
const dishesDir = path.join(process.cwd(), 'image', 'dishes');
fs.mkdirSync(dishesDir, { recursive: true });

const photos = fs.readdirSync(optDir).filter(f => f.endsWith('.jpg')).sort();
const photoSet = new Set(photos);

// Prefer unique cluster representatives for fill-in
let clusters = [];
let clusterReps = [];
const clusterOf = new Map(); // file → all files in same cluster
try {
  clusters = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'photo-clusters.json'), 'utf8'));
  clusterReps = clusters.map(c => c.representative).filter(f => photoSet.has(f));
  for (const c of clusters) {
    for (const f of c.files) {
      clusterOf.set(f, c.files.filter(x => photoSet.has(x)));
    }
  }
} catch {
  clusterReps = photos.slice();
}

function markPhotoUsed(file) {
  usedPhotos.add(file);
  const siblings = clusterOf.get(file) || [file];
  siblings.forEach(f => usedPhotos.add(f));
}

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
const assignments = []; // { id, file, method, confidence }

function assign(file, itemId, method, confidence) {
  if (!photoSet.has(file) || !byId.has(itemId)) return false;
  if (usedItems.has(itemId) || usedPhotos.has(file)) return false;

  const pub = `image/dishes/${itemId}.jpg`;
  const src = path.join(optDir, file);
  const dest = path.join(dishesDir, `${itemId}.jpg`);
  fs.copyFileSync(src, dest);

  update.run(pub, method, confidence, itemId);
  insertMatch.run(file, itemId, confidence, method, null);
  usedItems.add(itemId);
  markPhotoUsed(file);
  assignments.push({ id: itemId, name: byId.get(itemId).name, file, method, confidence });
  return true;
}

// 1) Curated
for (const [file, itemId] of Object.entries(CURATED)) {
  if (assign(file, itemId, 'visual-review', 0.95)) {
    console.log(`✓ ${file} → ${byId.get(itemId).name} (visual)`);
  }
}

// 2) Known matches-c.json remapped by visual content → new ids
const MATCHES_C_REMAP = {
  // file → new id (content-based)
  'IMG_2797.jpg': 'p0',
  'IMG_2799.jpg': 'p0',
  'IMG_2801.jpg': 'p1',
  'IMG_2803 (1).jpg': 'p1',
  'IMG_2804.jpg': 'p1',
  'IMG_2805.jpg': 'p1',
  'IMG_3473.jpg': 'd1',
  'IMG_3475.jpg': 'd1',
  'IMG_3497.jpg': 'd4',
  'IMG_3500.jpg': 'd4',
  'IMG_3501.jpg': 'd4',
  'IMG_4527.jpg': 's2',
  'IMG_4535.jpg': 'sl0',
  'IMG_4536.jpg': 'sl0',
  'IMG_4537.jpg': 'sl0',
  'IMG_4546.jpg': 'sl1',
  'IMG_4547.jpg': 'sl1',
  'IMG_4550.jpg': 'sl2',
  'IMG_4551.jpg': 'sl2',
  'IMG_4555.jpg': 'sl3',
  'IMG_4556.jpg': 'sl3',
  'IMG_4557.jpg': 'sl3',
  'IMG_4559.jpg': 'sl3',
};

for (const [file, itemId] of Object.entries(MATCHES_C_REMAP)) {
  // only use if item still needs a photo (first curated wins)
  if (!usedItems.has(itemId)) {
    if (assign(file, itemId, 'matches-c', 0.9)) {
      console.log(`✓ ${file} → ${byId.get(itemId).name} (matches-c)`);
    }
  }
}

// 3) Do NOT blindly assign leftover near-duplicate shots to unrelated dishes.
// Remaining food items stay without photos until more unique photos arrive
// or an admin rematches them.

// Write image-map.js
const withImages = db.prepare(`
  SELECT id, image_path FROM menu_items
  WHERE image_path IS NOT NULL AND image_path != ''
`).all();

const mapLines = withImages.map(r => `  ${JSON.stringify(r.id)}: ${JSON.stringify(r.image_path)}`).join(',\n');
const mapJs = `/* Auto-generated by scripts/assign-photos.js — do not edit by hand */\nconst IMAGE_MAP = {\n${mapLines}\n};\n\nif (typeof MENU !== 'undefined') {\n  MENU.forEach(item => {\n    if (IMAGE_MAP[item.id]) item.image = IMAGE_MAP[item.id];\n  });\n}\n`;
fs.writeFileSync(path.join(process.cwd(), 'js', 'image-map.js'), mapJs, 'utf8');

const foodWith = foodItems.filter(i => usedItems.has(i.id)).length;
console.log(`\nAssigned ${assignments.length} photos (curated only).`);
console.log(`Food with photos: ${foodWith}/${foodItems.length}`);
console.log(`image/dishes: ${fs.readdirSync(dishesDir).length} files`);
console.log(`image-map.js: ${withImages.length} entries`);

const missing = foodItems.filter(i => !usedItems.has(i.id));
if (missing.length) {
  console.log(`\nStill without unique photo (${missing.length}):`);
  missing.forEach(i => console.log(' -', i.id, i.name));
}
