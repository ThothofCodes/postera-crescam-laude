// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
const router = require('express').Router();
const { getTypes, getAvailability, getConsultations, getConsultation, createConsultation, confirmConsultation, completeConsultation, cancelConsultation, getStats } = require('../controllers/consultationController');
const AvailabilitySlot = require('../models/AvailabilitySlot');
const { protect, staffGuard, deptHeadGuard, superAdminGuard, staffReadScope } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createConsultationSchema, mongoId } = require('../validations/schemas');
const { z } = require('zod');

router.get('/types', getTypes);
router.get('/availability', getAvailability);
router.post('/', validate(createConsultationSchema), createConsultation);

router.post('/availability', protect, superAdminGuard, async (req, res, next) => {
  try {
    const slot = await AvailabilitySlot.create(req.body);
    res.status(201).json(slot);
  } catch (err) { next(err); }
});
router.get('/stats', protect, superAdminGuard, getStats);

router.get('/', protect, staffGuard, staffReadScope, getConsultations);
router.get('/:id', protect, staffGuard, staffReadScope, validate(z.object({ id: mongoId }), 'params'), getConsultation);
router.put('/:id/confirm', protect, deptHeadGuard, validate(z.object({ id: mongoId }), 'params'), confirmConsultation);
router.put('/:id/complete', protect, deptHeadGuard, validate(z.object({ id: mongoId }), 'params'), completeConsultation);
router.put('/:id/cancel', protect, deptHeadGuard, validate(z.object({ id: mongoId }), 'params'), cancelConsultation);

module.exports = router;
