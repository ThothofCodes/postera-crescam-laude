// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
const router = require('express').Router();
const { protect, superAdminGuard, staffGuard } = require('../middleware/auth');
const ctrl = require('../controllers/errorTracker');

// Public ingestion endpoint — frontend sends errors here (no auth required,
// rate-limited by the global write limiter exemption in server.js)
router.post('/', ctrl.ingestErrors);

// ── Protected endpoints (super admin for error management) ───────────────────
router.get('/stats', protect, staffGuard, ctrl.getErrorStats);
router.get('/', protect, staffGuard, ctrl.getErrors);
router.patch('/:id/status', protect, superAdminGuard, ctrl.updateErrorStatus);
router.delete('/:id', protect, superAdminGuard, ctrl.deleteError);
router.post('/clear', protect, superAdminGuard, ctrl.clearErrors);

module.exports = router;
