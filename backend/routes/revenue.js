// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
const router = require('express').Router();
const { z } = require('zod');
const {
  getRevenue, getSummary, createRevenue, updateRevenue, deleteRevenue,
} = require('../controllers/revenueController');
const { protect, staff } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createRevenueSchema, mongoId } = require('../validations/schemas');

router.use(protect, staff);
router.get('/summary', getSummary);
router.get('/', getRevenue);
router.post('/', validate(createRevenueSchema), createRevenue);
router.put('/:id', validate(z.object({ id: mongoId }), 'params'), updateRevenue);
router.delete('/:id', validate(z.object({ id: mongoId }), 'params'), deleteRevenue);

module.exports = router;
