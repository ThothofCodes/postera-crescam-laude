// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
const router = require('express').Router();
const { z } = require('zod');
const {
  getBookings, getBooking, createBooking, updateBooking, recordPayment, deleteBooking,
} = require('../controllers/bookingController');
const {
  protect, staffGuard, deptHeadGuard, staffReadScope,
} = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createBookingSchema, mongoId } = require('../validations/schemas');

router.get('/', protect, staffGuard, staffReadScope, getBookings);
router.get('/:id', protect, staffGuard, staffReadScope, validate(z.object({ id: mongoId }), 'params'), getBooking);
router.put('/:id/payment', protect, staffGuard, staffReadScope, validate(z.object({ id: mongoId }), 'params'), recordPayment);
router.post('/', protect, deptHeadGuard, validate(createBookingSchema), createBooking);
router.put('/:id', protect, deptHeadGuard, validate(z.object({ id: mongoId }), 'params'), updateBooking);
router.delete('/:id', protect, deptHeadGuard, validate(z.object({ id: mongoId }), 'params'), deleteBooking);

module.exports = router;
