const fs = require('fs');
const path = require('path');
const { db } = require('./db');
const {
  absolutizeImagePath,
  scheduleGithubSync,
  cfg: githubCfg,
} = require('./github-sync');
const { hydrateMissingImages, normalizeDishPath } = require('./hydrate-images');

function escapeStr(s) {
  return String(s ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function loadMenuRows() {
  const categories = db.prepare('SELECT name FROM categories ORDER BY sort_order, name').all();
  const items = db.prepare(`
    SELECT mi.*, c.name AS category_name
    FROM menu_items mi
    JOIN categories c ON c.id = mi.category_id
    WHERE mi.active = 1
    ORDER BY c.sort_order, mi.sort_order, mi.name
  `).all();
  return { categories, items };
}

function prepareImagePath(imagePath, { forGithub = false } = {}) {
  if (!imagePath) return '';
  let image = normalizeDishPath(imagePath);
  if (forGithub) image = absolutizeImagePath(image, githubCfg().publicBase) || '';
  return image;
}

function buildDataJs(categories, items, { forGithub = false } = {}) {
  const catList = categories.map(c => `  '${escapeStr(c.name)}'`).join(',\n');

  const itemBlocks = items.map(item => {
    const image = prepareImagePath(item.image_path, { forGithub });

    const parts = [
      `id: '${escapeStr(item.id)}'`,
      `cat: '${escapeStr(item.category_name)}'`,
    ];
    if (item.subcat) parts.push(`subcat: '${escapeStr(item.subcat)}'`);
    parts.push(`name: '${escapeStr(item.name)}'`);
    if (item.price != null) parts.push(`price: ${Number(item.price)}`);
    if (item.price2 != null) parts.push(`price2: ${Number(item.price2)}`);
    if (item.price_label) parts.push(`priceLabel: '${escapeStr(item.price_label)}'`);
    if (item.price2_label) parts.push(`price2Label: '${escapeStr(item.price2_label)}'`);
    if (item.volume) parts.push(`volume: '${escapeStr(item.volume)}'`);
    if (item.description) parts.push(`desc: '${escapeStr(item.description)}'`);
    if (image) parts.push(`image: '${escapeStr(image)}'`);
    return `  { ${parts.join(', ')} }`;
  }).join(',\n');

  return `const CATEGORY_ORDER = [\n${catList}\n];\n\nconst MENU = [\n${itemBlocks}\n];\n\nMENU.forEach((item, idx) => {\n  item.uid = \`item-\${idx}\`;\n});\n`;
}

function buildImageMapJs(items, { forGithub = false } = {}) {
  const withImages = items.filter(i => i.image_path);
  const mapLines = withImages.map(r => {
    const image = prepareImagePath(r.image_path, { forGithub });
    return `  ${JSON.stringify(r.id)}: ${JSON.stringify(image)}`;
  }).join(',\n');

  return `/* Auto-synced from admin */\nconst IMAGE_MAP = {\n${mapLines}\n};\n\nif (typeof MENU !== 'undefined') {\n  MENU.forEach(item => {\n    if (!item.image && IMAGE_MAP[item.id]) item.image = IMAGE_MAP[item.id];\n  });\n}\n`;
}

function writeLocalFiles(categories, items) {
  const dataJs = buildDataJs(categories, items, { forGithub: false });
  const mapJs = buildImageMapJs(items, { forGithub: false });
  fs.writeFileSync(path.join(process.cwd(), 'js', 'data.js'), dataJs, 'utf8');
  fs.writeFileSync(path.join(process.cwd(), 'js', 'image-map.js'), mapJs, 'utf8');
  return { dataJs, mapJs };
}

function syncMenuToDataJs() {
  // Always restore missing image_path from image/dishes + image-map before rewriting files
  const hydrated = hydrateMissingImages();
  if (hydrated.restored) {
    console.log(`[sync] restored ${hydrated.restored} missing dish photos from disk/map`);
  }

  const { categories, items } = loadMenuRows();
  writeLocalFiles(categories, items);

  // Queue GitHub Pages update (debounced)
  scheduleGithubSync(() => {
    hydrateMissingImages();
    const latest = loadMenuRows();
    return {
      message: `chore(menu): sync from admin (${latest.items.length} items)`,
      files: [
        {
          path: 'js/data.js',
          content: buildDataJs(latest.categories, latest.items, { forGithub: true }),
        },
        {
          path: 'js/image-map.js',
          content: buildImageMapJs(latest.items, { forGithub: true }),
        },
      ],
    };
  });

  return {
    categories: categories.length,
    items: items.length,
    withImages: items.filter(i => i.image_path).length,
    restored: hydrated.restored,
  };
}

module.exports = {
  syncMenuToDataJs,
  buildDataJs,
  buildImageMapJs,
  loadMenuRows,
  hydrateMissingImages,
};
