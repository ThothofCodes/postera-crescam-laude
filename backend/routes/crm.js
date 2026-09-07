// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
const router = require('express').Router();
const ctrl = require('../controllers/crmController');
const { protect, staffGuard, deptHeadGuard, superAdminGuard } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createCRMClientSchema, updateCRMClientSchema, mongoId } = require('../validations/schemas');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');

// Strict rate limiting for OTP endpoints to prevent brute-force
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.ip || 'unknown',
  message: { message: 'Too many OTP attempts. Try again in 15 minutes.', code: 'OTP_RATE_LIMITED' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/request-otp', otpLimiter, ctrl.requestOTP);
router.post('/verify-otp', otpLimiter, ctrl.verifyPortalOTP);

router.use(protect, staffGuard);
router.get('/', ctrl.getClients);
router.post('/', validate(createCRMClientSchema), ctrl.createClient);
router.get('/directory/all', superAdminGuard, ctrl.getClients);
router.post('/bulk-sms', deptHeadGuard, ctrl.bulkSMS);

router.get('/:id', validate(z.object({ id: mongoId }), 'params'), ctrl.getClient);
router.patch('/:id', validate(z.object({ id: mongoId }), 'params'), validate(updateCRMClientSchema), ctrl.updateClient);
router.post('/:id/interactions', validate(z.object({ id: mongoId }), 'params'), ctrl.addInteraction);
router.post('/:id/portal-invite', deptHeadGuard, validate(z.object({ id: mongoId }), 'params'), ctrl.sendPortalInvite);
router.post('/:id/redeem-points', protect, staffGuard, validate(z.object({ id: mongoId }), 'params'), require('../controllers/crmController').redeemPoints);
router.post('/:id/referral-code', protect, staffGuard, validate(z.object({ id: mongoId }), 'params'), require('../controllers/crmController').generateReferralCode);

module.exports = router;
