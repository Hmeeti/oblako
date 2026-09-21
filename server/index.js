require('dotenv').config();

const express = require('express');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const { initDb, logActivity, db } = require('./db');
const { getAdminConfig, verifyLogin } = require('./auth');
const { backfillMissingImages } = require('./images');
const { syncMenuToDataJs } = require('./sync-data');
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');

function ensureSeeded() {
  try {
    initDb();
    const count = db.prepare('SELECT COUNT(*) AS c FROM menu_items').get().c;
    if (count === 0) {
      console.log('[boot] Empty database — seeding from js/data.js …');
      execSync('node scripts/seed-menu.js', { stdio: 'inherit' });
    }

    const filled = backfillMissingImages();
    if (filled.filled > 0) {
      console.log(`[boot] Restored ${filled.filled} dish photos into database`);
      try {
        syncMenuToDataJs({ pushGithub: true });
      } catch (err) {
        console.warn('[boot] sync after backfill:', err.message);
      }
    } else {
      console.log(`[boot] Photo check: ${filled.checked} missing, nothing to restore`);
    }
  } catch (err) {
    console.warn('[boot] seed/backfill skipped:', err.message);
  }
}

ensureSeeded();

const app = express();
const { adminPath } = getAdminConfig();
const adminBase = `/${adminPath}`;

app.disable('x-powered-by');
app.set('trust proxy', 1);

// CORS for GitHub Pages → Railway public API
const corsOrigins = String(process.env.CORS_ORIGINS || process.env.PUBLIC_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && corsOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: '1mb' }));

app.use(session({
  name: 'oblako.sid',
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 2 * 60 * 60 * 1000,
  },
}));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});

function clientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
}

async function handleLogin(req, res) {
  const { username, password } = req.body || {};
  const ok = await verifyLogin(username, password);

  if (!ok) {
    logActivity({
      actor: username || 'anonymous',
      action: 'login.failed',
      details: { username },
      ip: clientIp(req),
    });
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  req.session.adminUser = username;
  logActivity({
    actor: username,
    action: 'login.success',
    ip: clientIp(req),
  });
  res.json({ ok: true, user: username });
}

function handleLogout(req, res) {
  const user = req.session?.adminUser;
  req.session.destroy(() => {
    if (user) {
      logActivity({ actor: user, action: 'logout', ip: clientIp(req) });
    }
    res.json({ ok: true });
  });
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'oblako', time: new Date().toISOString() });
});

// Public API
app.use('/api', publicRoutes);

// Admin API at /api/admin (used by admin.html)
app.post('/api/admin/login', loginLimiter, handleLogin);
app.post('/api/admin/logout', handleLogout);
app.use('/api/admin', adminRoutes);

// Also keep obscure path for compatibility
app.post(`${adminBase}/api/login`, loginLimiter, handleLogin);
app.post(`${adminBase}/api/logout`, handleLogout);
app.use(`${adminBase}/api`, adminRoutes);

const adminStatic = path.join(__dirname, '..', 'admin-panel');
app.use(adminBase, express.static(adminStatic, { index: 'index.html' }));
app.get(adminBase, (_req, res) => {
  res.sendFile(path.join(adminStatic, 'index.html'));
});

app.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send('User-agent: *\nAllow: /\nDisallow: /admin.html\nDisallow: /admin-panel/\n');
});

// Public static site (includes admin.html) — also used on Railway
app.use(express.static(path.join(__dirname, '..'), {
  index: 'index.html',
  extensions: ['html'],
}));

app.use((_req, res) => {
  res.status(404).send('Not found');
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`OBLAKO menu running at http://localhost:${port}`);
  console.log(`Admin panel: http://localhost:${port}/admin.html`);
  if (corsOrigins.length) {
    console.log(`CORS origins: ${corsOrigins.join(', ')}`);
  }
  if (!process.env.ADMIN_PASSWORD_HASH) {
    console.warn('Set ADMIN_PASSWORD_HASH in .env — run: npm run hash-password -- "your-password"');
  }
  // ensure data dir exists for SQLite
  try {
    fs.mkdirSync(path.dirname(path.resolve(process.cwd(), process.env.DATABASE_PATH || 'data/oblako.db')), { recursive: true });
  } catch (_) { /* ignore */ }
});
