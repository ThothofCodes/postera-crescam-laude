// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
const express = require('express');

const router = express.Router();
const { z } = require('zod');
const orderController = require('../controllers/orderController');
const { protect, staffGuard, deptAdminGuard } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  createOrderSchema, updateOrderStatusSchema, recordPaymentSchema, ordersQuerySchema, mongoId,
} = require('../validations/schemas');

router.get('/', protect, staffGuard, validate(ordersQuerySchema, 'query'), orderController.getOrders);
router.get('/phone/:phone', protect, staffGuard, orderController.getOrdersByPhone);
router.get('/:id', protect, staffGuard, validate(z.object({ id: mongoId }), 'params'), orderController.getOrder);
router.post('/', validate(createOrderSchema), orderController.createOrder);
router.put('/:id/status', protect, deptAdminGuard, validate(z.object({ id: mongoId }), 'params'), validate(updateOrderStatusSchema), orderController.updateOrderStatus);
router.put('/:id/payment', protect, deptAdminGuard, validate(z.object({ id: mongoId }), 'params'), validate(recordPaymentSchema), orderController.recordOrderPayment);

router.post('/send-stk/:identifier', protect, deptAdminGuard, orderController.sendStkPush);

// Public retry STK push — used by unauthenticated checkout users
router.post('/retry-payment/:id', validate(z.object({ id: mongoId }), 'params'), orderController.publicRetryStkPush);

// Public send-stk alias — initial STK push retry from checkout page
router.post('/pay/:id', validate(z.object({ id: mongoId }), 'params'), orderController.publicRetryStkPush);

// Public order status check — used by PaymentForm polling
router.get('/status/:identifier', orderController.getOrderStatus);

// Public switch to cash on pickup
router.post('/switch-to-cash/:id', validate(z.object({ id: mongoId }), 'params'), orderController.switchToCash);

// Public receipt lookup by order number — used by ReceiptPage
router.get('/receipt/:orderNumber', orderController.getReceiptByOrderNumber);

module.exports = router;
