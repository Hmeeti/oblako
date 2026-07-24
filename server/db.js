const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(process.cwd(), process.env.DATABASE_PATH || 'data/oblako.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id TEXT PRIMARY KEY,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      subcat TEXT,
      name TEXT NOT NULL,
      description TEXT,
      price INTEGER NOT NULL,
      price2 INTEGER,
      price_label TEXT,
      price2_label TEXT,
      volume TEXT,
      image_path TEXT,
      image_source TEXT,
      match_confidence REAL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      details TEXT,
      ip TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS analytics_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      path TEXT,
      category TEXT,
      user_agent TEXT,
      meta TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS image_matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_file TEXT NOT NULL,
      menu_item_id TEXT REFERENCES menu_items(id) ON DELETE SET NULL,
      confidence REAL,
      method TEXT,
      vision_notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_menu_category ON menu_items(category_id);
    CREATE INDEX IF NOT EXISTS idx_logs_created ON activity_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events(created_at DESC);
  `);
}

function logActivity({ actor, action, entityType = null, entityId = null, details = null, ip = null }) {
  db.prepare(`
    INSERT INTO activity_logs (actor, action, entity_type, entity_id, details, ip)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(actor, action, entityType, entityId, details ? JSON.stringify(details) : null, ip);
}

function trackEvent({ eventType, path: eventPath, category = null, userAgent = null, meta = null }) {
  db.prepare(`
    INSERT INTO analytics_events (event_type, path, category, user_agent, meta)
    VALUES (?, ?, ?, ?, ?)
  `).run(eventType, eventPath, category, userAgent, meta ? JSON.stringify(meta) : null);
}

function rowToItem(row) {
  if (!row) return null;
  return {
    id: row.id,
    cat: row.category_name,
    categoryId: row.category_id,
    subcat: row.subcat || undefined,
    name: row.name,
    desc: row.description || undefined,
    price: row.price,
    price2: row.price2 ?? undefined,
    priceLabel: row.price_label || undefined,
    price2Label: row.price2_label || undefined,
    volume: row.volume || undefined,
    image: row.image_path || undefined,
    imageSource: row.image_source || undefined,
    matchConfidence: row.match_confidence ?? undefined,
    active: Boolean(row.active),
    sortOrder: row.sort_order,
  };
}

function getPublicMenu() {
  const rows = db.prepare(`
    SELECT mi.*, c.name AS category_name, c.sort_order AS category_sort
    FROM menu_items mi
    JOIN categories c ON c.id = mi.category_id
    WHERE mi.active = 1
    ORDER BY c.sort_order, mi.sort_order, mi.name
  `).all();

  return rows.map(rowToItem);
}

function getCategoryOrder() {
  return db.prepare('SELECT name FROM categories ORDER BY sort_order, name').all().map(r => r.name);
}

module.exports = {
  db,
  initDb,
  logActivity,
  trackEvent,
  rowToItem,
  getPublicMenu,
  getCategoryOrder,
};
