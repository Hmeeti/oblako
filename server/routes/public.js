const express = require('express');
const { getPublicMenu, getCategoryOrder, trackEvent } = require('../db');

const router = express.Router();

router.get('/menu', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.json({
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
