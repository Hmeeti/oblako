/**
 * Emit data/menu.json from js/data.js + js/image-map.js for fast guest load.
 * Usage: node scripts/build-menu-json.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = process.cwd();
const dataCode = fs.readFileSync(path.join(root, 'js', 'data.js'), 'utf8');
const mapCode = fs.readFileSync(path.join(root, 'js', 'image-map.js'), 'utf8');
const ctx = {};
vm.runInNewContext(dataCode + '\n;this.MENU=MENU;this.CATEGORY_ORDER=CATEGORY_ORDER;', ctx);
vm.runInNewContext(mapCode + '\n;this.IMAGE_MAP=IMAGE_MAP;', ctx);

const BAR = new Set(['Кофе и чай', 'Безалкогольные', 'Алкогольные']);

const items = (ctx.MENU || []).map(item => {
  const image = item.image || (ctx.IMAGE_MAP && ctx.IMAGE_MAP[item.id]) || null;
  const out = {
    id: item.id,
    cat: item.cat,
    name: item.name,
    price: item.price ?? null,
  };
  if (item.subcat) out.subcat = item.subcat;
  if (item.desc) out.desc = item.desc;
  if (item.price2 != null) out.price2 = item.price2;
  if (item.priceLabel) out.priceLabel = item.priceLabel;
  if (item.price2Label) out.price2Label = item.price2Label;
  if (item.volume) out.volume = item.volume;
  if (item.objectPosition) out.objectPosition = item.objectPosition;
  if (!BAR.has(item.cat) && image) {
    const id = item.id;
    // Prefer optimized WebP set when present
    const w400 = `image/dishes/w400/${id}.webp`;
    const w800 = `image/dishes/w800/${id}.webp`;
    const hasWebp = fs.existsSync(path.join(root, w400));
    out.image = hasWebp ? w400 : image;
    if (hasWebp) {
      out.imageSrcset = `${w400} 400w, ${w800} 800w`;
      out.imageFull = w800;
    } else {
      out.imageFull = image;
    }
  }
  out.noPhoto = BAR.has(item.cat);
  return out;
});

const payload = {
  version: 1,
  updatedAt: new Date().toISOString(),
  categories: ctx.CATEGORY_ORDER || [],
  items,
};

const outDir = path.join(root, 'data');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'menu.json');
fs.writeFileSync(outPath, JSON.stringify(payload));
console.log(`Wrote ${outPath} (${items.length} items, ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB)`);
