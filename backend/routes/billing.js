// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
const router = require('express').Router();
const ctrl = require('../controllers/billingController');
const { protect, staffGuard, deptHeadGuard, superAdminGuard } = require('../middleware/auth');
const { webhookSignatureMiddleware } = require('../middleware/webhookSignature');
const { validate } = require('../middleware/validate');
const { createInvoiceSchema, invoicesQuerySchema, mongoId } = require('../validations/schemas');
const { z } = require('zod');

router.post('/mpesa-callback', webhookSignatureMiddleware, ctrl.mpesaCallback);

router.use(protect);

router.get('/', staffGuard, validate(invoicesQuerySchema, 'query'), ctrl.getInvoices);
router.post('/', deptHeadGuard, validate(createInvoiceSchema), ctrl.createInvoice);
router.get('/my', staffGuard, ctrl.getMyInvoices);
router.get('/overdue', deptHeadGuard, ctrl.getOverdue);
router.get('/consolidated', superAdminGuard, ctrl.getInvoices);
router.get('/:id', staffGuard, validate(z.object({ id: mongoId }), 'params'), ctrl.getInvoice);
router.patch('/:id/send', deptHeadGuard, validate(z.object({ id: mongoId }), 'params'), ctrl.sendInvoice);
router.post('/:id/pay', deptHeadGuard, validate(z.object({ id: mongoId }), 'params'), ctrl.initiatePayment);
router.patch('/:id/cancel', deptHeadGuard, validate(z.object({ id: mongoId }), 'params'), ctrl.cancelInvoice);

module.exports = router;
