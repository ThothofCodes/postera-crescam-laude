// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// PCL — Department Analytics Routes
const router = require('express').Router();
const { getDepartmentAnalytics, getDepartmentTimeline } = require('../controllers/departmentAnalyticsController');
const { protect, superAdminGuard } = require('../middleware/auth');
const { cacheMiddleware, TTL } = require('../middleware/cache');

// Cached — department analytics are heavy aggregation queries
router.get('/', protect, superAdminGuard, cacheMiddleware('deptAnalytics', TTL.SHORT), getDepartmentAnalytics);
router.get('/:slug/timeline', protect, superAdminGuard, cacheMiddleware('deptAnalytics:timeline', TTL.SHORT), getDepartmentTimeline);

module.exports = router;
