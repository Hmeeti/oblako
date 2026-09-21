const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { db } = require('./db');

function dishesDir() {
  return path.join(process.cwd(), 'image', 'dishes');
}

function loadImageMapFile() {
  const mapPath = path.join(process.cwd(), 'js', 'image-map.js');
  if (!fs.existsSync(mapPath)) return {};
  try {
    const code = fs.readFileSync(mapPath, 'utf8') + '\n; IMAGE_MAP;';
    const map = vm.runInNewContext(code, {});
    return map && typeof map === 'object' ? map : {};
  } catch (err) {
    console.warn('[images] failed to read image-map.js:', err.message);
    return {};
  }
}

function dishPhotoForId(id) {
  if (!id) return null;
  const rel = `image/dishes/${id}.jpg`;
  const abs = path.join(process.cwd(), rel);
  if (fs.existsSync(abs)) return rel;
  // also accept jpeg
  const rel2 = `image/dishes/${id}.jpeg`;
  if (fs.existsSync(path.join(process.cwd(), rel2))) return rel2;
  const rel3 = `image/dishes/${id}.webp`;
  if (fs.existsSync(path.join(process.cwd(), rel3))) return rel3;
  return null;
}

/**
 * Fill empty image_path from IMAGE_MAP and/or image/dishes/{id}.jpg
 * Never overwrites manual uploads or existing paths.
 */
function backfillMissingImages() {
  const map = loadImageMapFile();
  const rows = db.prepare(`
    SELECT id, image_path FROM menu_items
    WHERE image_path IS NULL OR image_path = ''
  `).all();

  const update = db.prepare(`
    UPDATE menu_items
    SET image_path = ?, image_source = ?, match_confidence = 1, updated_at = datetime('now')
    WHERE id = ?
  `);

  let filled = 0;
  for (const row of rows) {
    let next = null;
    let source = 'dishes';

    if (map[row.id]) {
      next = String(map[row.id]);
      source = 'image-map';
    }
    if (!next) {
      next = dishPhotoForId(row.id);
      source = 'dishes';
    }
    if (!next) continue;

    // Normalize absolute upload/http left as-is; ensure relative dish paths stay relative
    update.run(next, source, row.id);
    filled++;
  }

  return { filled, checked: rows.length };
}

/**
 * Build a complete id→image map for sync:
 * DB paths + static dish files + previous IMAGE_MAP (so sync never wipes photos).
 */
function buildMergedImageMap(dbItems) {
  const merged = { ...loadImageMapFile() };

  // Static files on disk win as defaults for known dish ids
  try {
    const dir = dishesDir();
    if (fs.existsSync(dir)) {
      for (const file of fs.readdirSync(dir)) {
        const m = file.match(/^([a-z0-9]+)\.(jpe?g|webp|png)$/i);
        if (!m) continue;
        const id = m[1];
        if (!merged[id]) merged[id] = `image/dishes/${file}`;
      }
    }
  } catch (_) { /* ignore */ }

  // DB values win (admin uploads / explicit URLs)
  for (const item of dbItems || []) {
    if (item.image_path) merged[item.id] = item.image_path;
  }

  return merged;
}

module.exports = {
  backfillMissingImages,
  buildMergedImageMap,
  loadImageMapFile,
  dishPhotoForId,
};
