// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
const router = require('express').Router();
const { login, register, getMe, verifyToken, setPassword, changeFirstPassword, logout } = require('../controllers/authController');
const { protect, superAdminGuard } = require('../middleware/auth');
const { setCsrfCookie } = require('../middleware/csrf');
const { validate } = require('../middleware/validate');
const { bruteForceProtection, getAllStatus } = require('../middleware/bruteForce');
const { loginSchema, registerSchema, changeFirstPasswordSchema, verifyTokenSchema, setPasswordSchema } = require('../validations/schemas');

router.get('/csrf-token', (req, res) => {
  const token = setCsrfCookie(res);
  res.json({ csrfToken: token });
});

// Brute-force protection: progressive delay + IP blocking on repeated failures
router.post('/login', bruteForceProtection, validate(loginSchema), login);
router.post('/verify-token', validate(verifyTokenSchema), verifyToken);
router.post('/set-password', validate(setPasswordSchema), setPassword);

router.use(protect);

// Brute-force status (super admin only — for security dashboard)
router.get('/brute-force-status', superAdminGuard, (req, res) => {
  res.json(getAllStatus());
});

router.post('/register', superAdminGuard, validate(registerSchema), register);
router.post('/change-first-password', validate(changeFirstPasswordSchema), changeFirstPassword);
router.post('/logout', logout);
router.get('/me', getMe);

module.exports = router;
