const express = require('express');
const { getPublicMenu, getCategoryOrder, trackEvent, db } = require('../db');

const router = express.Router();

function menuRevision() {
  try {
    return db.prepare('SELECT value FROM app_meta WHERE key = ?').get('menu_revision')?.value || null;
  } catch {
    return null;
  }
}

router.get('/menu', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.json({
    revision: menuRevision(),
    categories: getCategoryOrder(),
    items: getPublicMenu(),
    updatedAt: new Date().toISOString(),
  });
});

router.post('/analytics/event', express.json(), (req, res) => {
  const { eventType = 'page_view', path: eventPath = '/', category = null, meta = null } = req.body || {};
  trackEvent({
    eventType,
    path: eventPath,
    category,
    userAgent: req.get('user-agent'),
    meta,
  });
  res.status(204).end();
});

module.exports = router;
