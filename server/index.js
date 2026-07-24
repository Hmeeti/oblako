require('dotenv').config();

const express = require('express');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { initDb, logActivity } = require('./db');
const { getAdminConfig, verifyLogin } = require('./auth');
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');

initDb();

const app = express();
const { adminPath } = getAdminConfig();
const adminBase = `/${adminPath}`;

app.disable('x-powered-by');
app.set('trust proxy', 1);

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

// Public static site (includes admin.html)
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
  if (!process.env.ADMIN_PASSWORD_HASH) {
    console.warn('Set ADMIN_PASSWORD_HASH in .env — run: npm run hash-password -- "your-password"');
  }
});
