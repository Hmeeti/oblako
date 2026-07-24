const express = require('express');
const { getPublicMenu, getCategoryOrder, trackEvent } = require('../db');

const router = express.Router();

router.get('/menu', (req, res) => {
  res.json({
    categories: getCategoryOrder(),
    items: getPublicMenu(),
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
