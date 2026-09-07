// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// Monetization routes — ad campaigns, promo codes, platform fees, and unified dashboard.

const router = require('express').Router();
const { z } = require('zod');
const ctrl = require('../controllers/monetizationController');
const {
  protect, staffGuard, deptHeadGuard, superAdminGuard,
} = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { mongoId } = require('../validations/schemas');

// ── Zod schemas ────────────────────────────────────────────────────────────

const createCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  advertiser: z.string().min(1).max(200),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  type: z.enum(['banner', 'sponsored_article', 'inline_text', 'popup', 'sidebar']),
  title: z.string().min(1).max(200),
  body: z.string().optional(),
  imageUrl: z.string().url().optional(),
  linkUrl: z.string().url().optional(),
  ctaText: z.string().max(50).optional(),
  position: z.enum(['top', 'bottom', 'sidebar', 'inline', 'popup', 'footer']).optional(),
  targetPages: z.array(z.string()).optional(),
  targetAudience: z.enum(['all', 'logged_in', 'new_visitors', 'returning']).optional(),
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()),
  pricingModel: z.enum(['cpm', 'cpc', 'flat_rate', 'free']).optional(),
  budget: z.number().min(0).optional(),
  costPerImpression: z.number().min(0).optional(),
  costPerClick: z.number().min(0).optional(),
});

const createPromoSchema = z.object({
  code: z.string().min(3).max(30).regex(/^[A-Za-z0-9_-]+$/, 'Code can only contain letters, numbers, hyphens, underscores'),
  description: z.string().max(500).optional(),
  type: z.enum(['percentage', 'fixed_amount', 'free_shipping', 'buy_x_get_y']),
  value: z.number().min(0),
  maxDiscount: z.number().min(0).optional(),
  minOrderAmount: z.number().min(0).optional(),
  appliesTo: z.enum(['all', 'products', 'services', 'orders', 'bookings', 'consultations']).optional(),
  usageLimit: z.number().min(1).optional(),
  perUserLimit: z.number().min(1).optional(),
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()),
  isReferralCode: z.boolean().optional(),
  referralReward: z.number().min(0).optional(),
});

const validatePromoSchema = z.object({
  code: z.string().min(1),
  orderAmount: z.number().min(0).optional(),
  itemType: z.string().optional(),
});

const trackImpressionSchema = z.object({
  campaignId: z.string().min(1),
});

const trackClickSchema = z.object({
  campaignId: z.string().min(1),
});

// ════════════════════════════════════════════════════════════════════════════
//  PUBLIC ROUTES (no auth required)
// ════════════════════════════════════════════════════════════════════════════

// Get active ads for a page
router.get('/ads/active', ctrl.getActiveAds);

// Track ad impression (public — called from frontend)
router.post('/ads/impression', validate(trackImpressionSchema), ctrl.trackImpression);

// Track ad click (public — called from frontend)
router.post('/ads/click', validate(trackClickSchema), ctrl.trackClick);

// Validate a promo code (public — called before checkout)
router.post('/promos/validate', validate(validatePromoSchema), ctrl.validatePromoCode);

// ════════════════════════════════════════════════════════════════════════════
//  PROTECTED ROUTES (auth required)
// ════════════════════════════════════════════════════════════════════════════

router.use(protect);

// ── Ad Campaigns (admin only) ──────────────────────────────────────────────
router.get('/ads', staffGuard, ctrl.getCampaigns);
router.post('/ads', deptHeadGuard, validate(createCampaignSchema), ctrl.createCampaign);
router.put('/ads/:id', deptHeadGuard, validate(z.object({ id: mongoId }), 'params'), ctrl.updateCampaign);
router.delete('/ads/:id', deptHeadGuard, validate(z.object({ id: mongoId }), 'params'), ctrl.deleteCampaign);

// ── Promo Codes (staff+ can manage, all authenticated can validate) ────────
router.get('/promos', staffGuard, ctrl.getPromoCodes);
router.post('/promos', deptHeadGuard, validate(createPromoSchema), ctrl.createPromoCode);
router.put('/promos/:id', deptHeadGuard, validate(z.object({ id: mongoId }), 'params'), ctrl.updatePromoCode);
router.delete('/promos/:id', deptHeadGuard, validate(z.object({ id: mongoId }), 'params'), ctrl.deletePromoCode);

// ── Platform Fees ──────────────────────────────────────────────────────────
router.get('/fees', staffGuard, ctrl.getFeeTransactions);
router.get('/fees/summary', staffGuard, ctrl.getFeeSummary);

// ── Monetization Dashboard ─────────────────────────────────────────────────
router.get('/dashboard', superAdminGuard, ctrl.getDashboard);

module.exports = router;
