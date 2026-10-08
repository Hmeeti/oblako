const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const {
  db,
  logActivity,
  trackEvent,
  rowToItem,
  getCategoryOrder,
} = require('../db');
const { requireAuth } = require('../auth');
const { syncMenuToDataJs } = require('../sync-data');
const { pushBinaryFile, cfg: githubCfg } = require('../github-sync');
const { backfillMissingImages } = require('../images');

const router = express.Router();

function syncPublicMenu() {
  try {
    return syncMenuToDataJs();
  } catch (err) {
    console.warn('[sync]', err.message);
    return null;
  }
}

router.post('/repair-images', requireAuth, (_req, res) => {
  const result = backfillMissingImages();
  syncPublicMenu();
  const withImages = db.prepare(`
    SELECT COUNT(*) AS c FROM menu_items
    WHERE active = 1 AND image_path IS NOT NULL AND image_path != ''
  `).get().c;
  res.json({ ok: true, ...result, withImages });
});

const uploadDir = path.join(process.cwd(), 'image', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `${Date.now()}-${uuidv4().slice(0, 8)}${ext}`);
    },
  }),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files allowed'));
  },
});

function actor(req) {
  return req.session?.adminUser || 'unknown';
}

function clientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
}

router.get('/session', (req, res) => {
  if (req.session?.adminUser) {
    res.json({ authenticated: true, user: req.session.adminUser });
  } else {
    res.json({ authenticated: false });
  }
});

router.get('/dashboard', requireAuth, (_req, res) => {
  const { cfg } = require('../github-sync');
  const gh = cfg();
  const stats = {
    items: db.prepare('SELECT COUNT(*) AS c FROM menu_items WHERE active = 1').get().c,
    categories: db.prepare('SELECT COUNT(*) AS c FROM categories').get().c,
    withImages: db.prepare("SELECT COUNT(*) AS c FROM menu_items WHERE active = 1 AND image_path IS NOT NULL AND image_path != ''").get().c,
    viewsToday: db.prepare(`
      SELECT COUNT(*) AS c FROM analytics_events
      WHERE event_type = 'page_view' AND date(created_at) = date('now')
    `).get().c,
    viewsWeek: db.prepare(`
      SELECT COUNT(*) AS c FROM analytics_events
      WHERE event_type = 'page_view' AND created_at >= datetime('now', '-7 days')
    `).get().c,
    recentLogs: db.prepare(`
      SELECT id, actor, action, entity_type, entity_id, details, created_at
      FROM activity_logs ORDER BY created_at DESC LIMIT 8
    `).all(),
    githubSync: {
      configured: Boolean(gh.token),
      repo: gh.repo,
      branch: gh.branch,
      publicBase: gh.publicBase || null,
    },
  };
  res.json(stats);
});

router.get('/categories', requireAuth, (_req, res) => {
  const rows = db.prepare('SELECT * FROM categories ORDER BY sort_order, name').all();
  res.json(rows);
});

router.post('/categories', requireAuth, express.json(), (req, res) => {
  const { name, sortOrder = 0 } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });

  const result = db.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)').run(name.trim(), sortOrder);
  logActivity({
    actor: actor(req),
    action: 'category.create',
    entityType: 'category',
    entityId: String(result.lastInsertRowid),
    details: { name },
    ip: clientIp(req),
  });
  syncPublicMenu();
  res.status(201).json({ id: result.lastInsertRowid, name: name.trim(), sort_order: sortOrder });
});

router.put('/categories/:id', requireAuth, express.json(), (req, res) => {
  const { name, sortOrder } = req.body;
  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  db.prepare('UPDATE categories SET name = ?, sort_order = ? WHERE id = ?').run(
    name?.trim() || existing.name,
    sortOrder ?? existing.sort_order,
    req.params.id
  );
  logActivity({
    actor: actor(req),
    action: 'category.update',
    entityType: 'category',
    entityId: req.params.id,
    details: { name, sortOrder },
    ip: clientIp(req),
  });
  syncPublicMenu();
  res.json({ ok: true });
});

router.delete('/categories/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  logActivity({
    actor: actor(req),
    action: 'category.delete',
    entityType: 'category',
    entityId: req.params.id,
    details: { name: existing.name },
    ip: clientIp(req),
  });
  syncPublicMenu();
  res.json({ ok: true });
});

router.get('/items', requireAuth, (_req, res) => {
  const rows = db.prepare(`
    SELECT mi.*, c.name AS category_name
    FROM menu_items mi
    JOIN categories c ON c.id = mi.category_id
    ORDER BY c.sort_order, mi.sort_order, mi.name
  `).all();
  res.json(rows.map(rowToItem));
});

router.post('/items', requireAuth, express.json(), (req, res) => {
  const {
    id = `item-${uuidv4().slice(0, 8)}`,
    categoryId,
    subcat = null,
    name,
    description = null,
    price,
    price2 = null,
    priceLabel = null,
    price2Label = null,
    volume = null,
    sortOrder = 0,
  } = req.body;

  if (!categoryId || !name?.trim() || price == null) {
    return res.status(400).json({ error: 'categoryId, name, and price are required' });
  }

  db.prepare(`
    INSERT INTO menu_items (
      id, category_id, subcat, name, description, price, price2,
      price_label, price2_label, volume, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, categoryId, subcat, name.trim(), description, price, price2, priceLabel, price2Label, volume, sortOrder);

  logActivity({
    actor: actor(req),
    action: 'item.create',
    entityType: 'menu_item',
    entityId: id,
    details: { name, price },
    ip: clientIp(req),
  });
  syncPublicMenu();
  res.status(201).json({ id });
});

router.put('/items/:id', requireAuth, express.json(), (req, res) => {
  const existing = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const fields = {
    category_id: req.body.categoryId ?? existing.category_id,
    subcat: req.body.subcat ?? existing.subcat,
    name: req.body.name?.trim() ?? existing.name,
    description: req.body.description ?? existing.description,
    price: req.body.price ?? existing.price,
    price2: req.body.price2 ?? existing.price2,
    price_label: req.body.priceLabel ?? existing.price_label,
    price2_label: req.body.price2Label ?? existing.price2_label,
    volume: req.body.volume ?? existing.volume,
    sort_order: req.body.sortOrder ?? existing.sort_order,
    active: req.body.active != null ? (req.body.active ? 1 : 0) : existing.active,
    updated_at: new Date().toISOString(),
  };

  db.prepare(`
    UPDATE menu_items SET
      category_id = @category_id, subcat = @subcat, name = @name, description = @description,
      price = @price, price2 = @price2, price_label = @price_label, price2_label = @price2_label,
      volume = @volume, sort_order = @sort_order, active = @active, updated_at = @updated_at
    WHERE id = @id
  `).run({ ...fields, id: req.params.id });

  logActivity({
    actor: actor(req),
    action: 'item.update',
    entityType: 'menu_item',
    entityId: req.params.id,
    details: req.body,
    ip: clientIp(req),
  });
  syncPublicMenu();
  res.json({ ok: true });
});

router.delete('/items/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  db.prepare('DELETE FROM menu_items WHERE id = ?').run(req.params.id);
  logActivity({
    actor: actor(req),
    action: 'item.delete',
    entityType: 'menu_item',
    entityId: req.params.id,
    details: { name: existing.name },
    ip: clientIp(req),
  });
  syncPublicMenu();
  res.json({ ok: true });
});

router.post('/items/:id/image', requireAuth, upload.single('image'), (req, res) => {
  const existing = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

  const imagePath = `/image/uploads/${req.file.filename}`;
  db.prepare(`
    UPDATE menu_items SET image_path = ?, image_source = 'manual', match_confidence = 1, updated_at = datetime('now')
    WHERE id = ?
  `).run(imagePath, req.params.id);

  logActivity({
    actor: actor(req),
    action: 'item.image.assign',
    entityType: 'menu_item',
    entityId: req.params.id,
    details: { imagePath, filename: req.file.filename },
    ip: clientIp(req),
  });
  syncPublicMenu();
  // Also mirror upload into GitHub so Pages can serve it if needed
  const localFile = path.join(uploadDir, req.file.filename);
  const remotePath = `image/uploads/${req.file.filename}`;
  pushBinaryFile(remotePath, localFile, `chore(menu): upload photo for ${req.params.id}`)
    .then(r => {
      if (r.pushed) console.log('[github-sync] uploaded', remotePath);
      if (r.skipped) console.warn('[github-sync] upload skipped:', r.reason);
    })
    .catch(err => console.error('[github-sync] upload failed:', err.message));

  const publicBase = githubCfg().publicBase;
  const publicImage = publicBase ? `${publicBase}${imagePath}` : imagePath;
  res.json({ image: imagePath, publicImage });
});

router.post('/items/:id/image-url', requireAuth, express.json(), (req, res) => {
  const existing = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  let url = String(req.body?.url || '').trim();
  if (!url) return res.status(400).json({ error: 'URL required' });

  // Allow relative paths like /image/... and absolute http(s) URLs
  if (!url.startsWith('/') && !/^https?:\/\//i.test(url)) {
    return res.status(400).json({ error: 'Нужна ссылка http(s):// или путь /image/...' });
  }

  db.prepare(`
    UPDATE menu_items SET image_path = ?, image_source = 'url', match_confidence = 1, updated_at = datetime('now')
    WHERE id = ?
  `).run(url, req.params.id);

  logActivity({
    actor: actor(req),
    action: 'item.image.url',
    entityType: 'menu_item',
    entityId: req.params.id,
    details: { url },
    ip: clientIp(req),
  });
  syncPublicMenu();
  res.json({ image: url });
});

router.post('/items/:id/image/clear', requireAuth, (req, res) => {
  db.prepare(`
    UPDATE menu_items SET image_path = NULL, image_source = NULL, match_confidence = NULL, updated_at = datetime('now')
    WHERE id = ?
  `).run(req.params.id);

  logActivity({
    actor: actor(req),
    action: 'item.image.clear',
    entityType: 'menu_item',
    entityId: req.params.id,
    ip: clientIp(req),
  });
  syncPublicMenu();
  res.json({ ok: true });
});

router.get('/logs', requireAuth, (req, res) => {
  const { action, actor: actorFilter, limit = 100, offset = 0 } = req.query;
  let sql = 'SELECT * FROM activity_logs WHERE 1=1';
  const params = [];

  if (action) {
    sql += ' AND action LIKE ?';
    params.push(`%${action}%`);
  }
  if (actorFilter) {
    sql += ' AND actor LIKE ?';
    params.push(`%${actorFilter}%`);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  const rows = db.prepare(sql).all(...params);
  const total = db.prepare('SELECT COUNT(*) AS c FROM activity_logs').get().c;
  res.json({ rows, total });
});

router.get('/analytics', requireAuth, (_req, res) => {
  const byDay = db.prepare(`
    SELECT date(created_at) AS day, COUNT(*) AS views
    FROM analytics_events
    WHERE event_type = 'page_view' AND created_at >= datetime('now', '-14 days')
    GROUP BY date(created_at)
    ORDER BY day
  `).all();

  const topCategories = db.prepare(`
    SELECT category, COUNT(*) AS views
    FROM analytics_events
    WHERE event_type = 'category_view' AND category IS NOT NULL
    GROUP BY category
    ORDER BY views DESC
    LIMIT 10
  `).all();

  res.json({ byDay, topCategories });
});

router.get('/image-matches', requireAuth, (_req, res) => {
  const rows = db.prepare(`
    SELECT im.*, mi.name AS item_name
    FROM image_matches im
    LEFT JOIN menu_items mi ON mi.id = im.menu_item_id
    ORDER BY im.created_at DESC
    LIMIT 200
  `).all();
  res.json(rows);
});

module.exports = router;
