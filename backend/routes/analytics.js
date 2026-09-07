// Copyright (c) 2026 Thoth of Codes.
const router = require('express').Router();
const { protect, staffGuard, superAdminGuard } = require('../middleware/auth');
const ctrl = require('../controllers/analyticsController');
const { cacheMiddleware, invalidateCache, TTL } = require('../middleware/cache');
const logger = require('../utils/logger');

// Dashboard reads — cached with SHORT TTL (30s) for near-realtime feel
router.get('/', protect, staffGuard, cacheMiddleware('analytics', TTL.SHORT), ctrl.getSnapshots);
router.get('/summary', protect, staffGuard, cacheMiddleware('analytics:summary', TTL.SHORT), ctrl.getSummary);
router.get('/departments', protect, superAdminGuard, cacheMiddleware('analytics:departments', TTL.SHORT), ctrl.getDeptComparison);

// Trigger snapshot — invalidate analytics cache
router.post('/trigger', protect, superAdminGuard, async (req, res, next) => {
  await ctrl.triggerSnapshot(req, res, next);
  // Invalidate analytics cache after snapshot trigger
  if (res.statusCode < 400) invalidateCache('analytics').catch(() => {});
});

// Public event ingestion — receives consent-gated analytics events from the frontend.
// No auth required (anonymous visitors track page views).
// Rate-limited globally; rejects payloads >50 events to prevent abuse.
router.post('/events', async (req, res) => {
  try {
    const { events } = req.body;
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ message: 'events array is required' });
    }
    // Cap payload size
    const batch = events.slice(0, 50);

    // For now, log events to structured logger.
    // In production, flush to a time-series store (ClickHouse, TimescaleDB, etc.)
    batch.forEach((e) => {
      logger.info('analytics_event', {
        event: e.event,
        timestamp: e.timestamp,
        sessionId: e.sessionId,
        url: e.url,
        properties: e,
      });
    });

    res.json({ received: batch.length });
  } catch (err) {
    // Never fail the client on analytics — silently swallow
    logger.error('analytics_events_error', { error: err.message });
    res.json({ received: 0 });
  }
});

module.exports = router;
