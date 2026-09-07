// Copyright (c) 2026 Thoth of Codes.
const router = require('express').Router();
const { getMyNotifications, markRead, broadcast } = require('../controllers/notificationController');
const { getAuditLogs } = require('../controllers/auditController');
const { getRevenueStats, getRevenueChartData } = require('../controllers/adminRevenueController');
const { protect, superAdminGuard, staffGuard } = require('../middleware/auth');
const { cacheMiddleware, invalidateCache, TTL } = require('../middleware/cache');

// Notifications and audit logs — no cache (realtime)
router.get('/notifications', protect, staffGuard, getMyNotifications);
router.put('/notifications/:id/read', protect, staffGuard, markRead);
router.post('/notifications/broadcast', protect, superAdminGuard, broadcast);
router.get('/audit', protect, staffGuard, getAuditLogs);

// Revenue endpoints — cached with SHORT TTL (30s)
router.get('/stats', protect, staffGuard, cacheMiddleware('admin:stats', TTL.SHORT), getRevenueStats);
router.get('/revenue', protect, staffGuard, cacheMiddleware('admin:revenue', TTL.SHORT), getRevenueChartData);

module.exports = router;
