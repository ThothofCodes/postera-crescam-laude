// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
const router = require('express').Router();
const {
  getUsers, createUser, updateUser, resetPassword, deactivateUser, changeSiteManagerEmail,
} = require('../controllers/userController');
const { protect, staffManagerGuard, superAdminGuard } = require('../middleware/auth');

// All routes require authentication + staff manager permission
router.use(protect, staffManagerGuard);

// GET — Super Admin sees all; Dept Head sees own dept only (filtered in controller)
router.get('/', getUsers);

// POST — Super Admin can assign any role; Dept Head can only create STAFF in own dept
router.post('/', createUser);

// PUT/DELETE — scoped in controller
router.put('/:id', updateUser);
router.post('/:id/reset-password', resetPassword);
router.delete('/:id', deactivateUser);

// SUPER_ADMIN only — change SITE_MANAGER email
router.put('/:id/change-email', superAdminGuard, changeSiteManagerEmail);

module.exports = router;
