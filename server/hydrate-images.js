/**
 * Restore / preserve dish photos so admin sync never wipes the gallery.
 *
 * Photos live in image/dishes/{id}.jpg and js/image-map.js. Seed used to
 * insert menu rows without image_path, so the first admin upload rebuilt
 * image-map.js from SQLite with only that one photo.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { db } = require('./db');

function loadImageMapFile() {
  const mapPath = path.join(process.cwd(), 'js', 'image-map.js');
  if (!fs.existsSync(mapPath)) return {};
  try {
    const code = fs.readFileSync(mapPath, 'utf8') + '\n; IMAGE_MAP';
    const map = vm.runInNewContext(code, Object.create(null), { timeout: 2000 });
    return map && typeof map === 'object' ? map : {};
  } catch {
    return {};
  }
}

function discoverDishImages() {
  const dir = path.join(process.cwd(), 'image', 'dishes');
  const map = {};
  if (!fs.existsSync(dir)) return map;
  for (const file of fs.readdirSync(dir)) {
    if (!/\.jpe?g$/i.test(file)) continue;
    const id = path.basename(file, path.extname(file));
    map[id] = `image/dishes/${file}`;
  }
  return map;
}

/** Prefer relative image/dishes paths for GitHub Pages static hosting. */
function normalizeDishPath(imagePath) {
  if (!imagePath) return imagePath;
  const s = String(imagePath).trim();
  const m = s.match(/^\/?image\/dishes\/([^/?#]+)$/i);
  if (m) return `image/dishes/${m[1]}`;
  return s;
}

/**
 * Fill empty image_path from image/dishes + existing image-map.js.
 * Never overwrites an existing path (manual upload / URL wins).
 * @returns {{ restored: number, known: number }}
 */
function hydrateMissingImages() {
  const fromDisk = discoverDishImages();
  const fromFile = loadImageMapFile();
  const candidates = { ...fromDisk };

  for (const [id, raw] of Object.entries(fromFile)) {
    const normalized = normalizeDishPath(raw);
    // Prefer on-disk dish files for static ids; keep uploads/URLs from the map
    if (fromDisk[id] && !/uploads/i.test(String(raw)) && !/^https?:\/\//i.test(String(raw))) {
      candidates[id] = fromDisk[id];
    } else {
      candidates[id] = normalized;
    }
  }

  const update = db.prepare(`
    UPDATE menu_items
    SET image_path = ?, image_source = COALESCE(NULLIF(image_source, ''), 'static'),
        updated_at = datetime('now')
    WHERE id = ?
      AND (image_path IS NULL OR image_path = '')
  `);

  // Also normalize leading-slash dish paths already in DB
  const normalizeExisting = db.prepare(`
    UPDATE menu_items
    SET image_path = ?, updated_at = datetime('now')
    WHERE id = ? AND image_path = ?
  `);

  let restored = 0;
  for (const [id, imagePath] of Object.entries(candidates)) {
    if (!imagePath) continue;
    const row = db.prepare('SELECT image_path FROM menu_items WHERE id = ?').get(id);
    if (!row) continue;

    if (!row.image_path) {
      update.run(imagePath, id);
      restored++;
      continue;
    }

    const current = String(row.image_path);
    const asDish = normalizeDishPath(current);
    if (asDish !== current && asDish.startsWith('image/dishes/')) {
      normalizeExisting.run(asDish, id, current);
    }
  }

  return { restored, known: Object.keys(candidates).length };
}

module.exports = {
  hydrateMissingImages,
  discoverDishImages,
  loadImageMapFile,
  normalizeDishPath,
};
