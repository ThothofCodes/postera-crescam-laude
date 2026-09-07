// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
const router = require('express').Router();
const { z } = require('zod');
const {
  getPricingRules, getEstimate, updatePricingRule, seedPricingRules,
} = require('../controllers/calculatorController');
const { protect, admin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { calculatorSchema, pricingRuleSchema, mongoId } = require('../validations/schemas');

router.get('/pricing-rules', getPricingRules);
router.post('/estimate', validate(calculatorSchema), getEstimate);
router.post('/seed', protect, admin, seedPricingRules);
router.put('/pricing-rules/:id', protect, admin, validate(z.object({ id: mongoId }), 'params'), validate(pricingRuleSchema), updatePricingRule);

module.exports = router;
