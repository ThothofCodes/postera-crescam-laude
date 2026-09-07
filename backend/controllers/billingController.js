const generateReceipt = require('../utils/generateReceipt');
// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
const Invoice = require('../models/Invoice');
const logger = require('../utils/logger');
const { stkPush, isCallbackProcessed, markCallbackProcessed } = require('../middleware/mpesa');
const { sendSMS } = require('../config/africastalking');
const { invalidateMultiple } = require('../middleware/cache');

// Zod validates: client ID, line items, due date, ID params, query params

exports.createInvoice = async (req, res, next) => {
  try {
    const { clientId, lineItems, dueDate, notes, taxRate } = req.body;
    const items = lineItems.map((i) => ({
      description: i.description.slice(0, 200),
      qty: Math.max(1, i.qty),
      unitPrice: Math.max(0, i.unitPrice),
      total: Math.max(1, i.qty) * Math.max(0, i.unitPrice),
    }));
    const subtotal = items.reduce((s, i) => s + i.total, 0);
    const rate = taxRate || 0.16;
    const taxAmount = Math.round(subtotal * rate * 100) / 100;
    const total = subtotal + taxAmount;

    const invoice = await Invoice.create({
      department: req.user.department?._id || req.user.department,
      departmentSlug: req.user.departmentSlug,
      client: clientId,
      lineItems: items,
      subtotal,
      taxRate: rate,
      taxAmount,
      totalAmount: total,
      balance: total,
      dueDate: new Date(dueDate),
      notes: notes?.slice(0, 500),
      createdBy: req.user._id,
    });
    res.status(201).json(invoice);
  } catch (err) { next(err); }
};

exports.getInvoices = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, clientId } = req.query;
    const filter = req.user.role === 'SUPER_ADMIN' ? {} : { departmentSlug: req.user.departmentSlug };
    if (status) filter.status = status;
    if (clientId) filter.client = clientId;
    const [invoices, total] = await Promise.all([
      Invoice.find(filter).populate('client', 'fullName phone').sort('-createdAt').skip((page - 1) * limit).limit(limit),
      Invoice.countDocuments(filter),
    ]);
    res.json({ invoices, total, page });
  } catch (err) { next(err); }
};

exports.getInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('client', 'fullName phone email');
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    res.json(invoice);
  } catch (err) { next(err); }
};

exports.sendInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('client', 'fullName phone email');
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (invoice.status !== 'DRAFT') return res.status(400).json({ message: 'Only DRAFT invoices can be sent' });
    invoice.status = 'SENT';
    await invoice.save();
    const notifyTo = invoice.client.email || invoice.client.phone;
    if (notifyTo) sendSMS(notifyTo, `Invoice ${invoice.invoiceId} from Postera Crescam Laude: KES ${invoice.totalAmount}. Due: ${invoice.dueDate.toDateString()}. Pay via M-Pesa or visit our portal.`);
    res.json(invoice);
  } catch (err) { next(err); }
};

exports.initiatePayment = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('client', 'fullName phone');
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (['PAID', 'CANCELLED'].includes(invoice.status)) return res.status(400).json({ message: `Invoice is already ${invoice.status}` });
    const mpesaRes = await stkPush(invoice.client.phone, invoice.balance, invoice.invoiceId, 'PCL Invoice');
    invoice.checkoutRequestId = mpesaRes.CheckoutRequestID;
    invoice.status = 'PAYMENT_SENT';
    await invoice.save();
    res.json({ message: 'STK push sent', checkoutRequestId: mpesaRes.CheckoutRequestID });
  } catch (err) { next(err); }
};

exports.mpesaCallback = async (req, res) => {
  try { res.json({ ResultCode: 0, ResultDesc: 'Success' }); } catch (_) {}
  try {
    const result = req.body?.Body?.stkCallback;
    if (!result || result.ResultCode !== 0) return;
    const { CheckoutRequestID, CallbackMetadata } = result;
    if (isCallbackProcessed(CheckoutRequestID)) { logger.warn(`[MPESA-BILLING] Callback replay blocked: ${CheckoutRequestID}`); return; }
    markCallbackProcessed(CheckoutRequestID);
    const meta = {};
    CallbackMetadata?.Item?.forEach(({ Name, Value }) => { meta[Name] = Value; });
    const invoice = await Invoice.findOne({ checkoutRequestId: CheckoutRequestID });
    if (!invoice || invoice.status === 'PAID') return;
    const paid = Number(meta.Amount) || 0;
    invoice.amountPaid += paid;
    invoice.balance = invoice.totalAmount - invoice.amountPaid;
    invoice.mpesaRef = String(meta.MpesaReceiptNumber || '').replace(/[^A-Z0-9]/gi, '').slice(0, 20);
    invoice.status = invoice.balance <= 0 ? 'PAID' : 'PARTIAL';
    if (invoice.status === 'PAID') invoice.paidAt = new Date();
    await invoice.save();
    invalidateMultiple(['admin:stats', 'admin:revenue', 'analytics', 'deptAnalytics']).catch(() => {});
    if (invoice.status === 'PAID') {
      try { const pts = Math.floor((invoice.amountPaid || 0) / 100); if (pts > 0) await require('../models/CRMClient').findByIdAndUpdate(invoice.clientId, { $inc: { loyaltyPoints: pts } }); } catch (_) {}
      generateReceipt(invoice).then((url) => { if (url) require('../models/Invoice').findByIdAndUpdate(invoice._id, { receiptUrl: url }).catch(() => {}); }).catch(() => {});
      // Record platform fee for monetization tracking
      const { recordFee } = require('../controllers/monetizationController');
      recordFee({
        sourceType: 'invoice', sourceId: invoice._id, sourceModel: 'Invoice',
        grossAmount: paid, department: invoice.department, category: 'billing',
        paymentMethod: 'mpesa', paymentReference: invoice.mpesaRef,
        description: `Invoice ${invoice.invoiceId}`,
      }).catch(() => {});
    }
    try {
      const { emitPaymentResult } = require('../socket');
      emitPaymentResult(CheckoutRequestID, { success: invoice.status === 'PAID', invoiceId: invoice._id, mpesaRef: invoice.mpesaRef, amount: invoice.amountPaid, paidAt: invoice.paidAt });
    } catch (_) {}
    const client = await require('../models/CRMClient').findById(invoice.client);
    if (client) { const notifyTo = client.email || client.phone; if (notifyTo) sendSMS(notifyTo, `Payment of KES ${paid} received for invoice ${invoice.invoiceId}. Ref: ${invoice.mpesaRef}. Balance: KES ${invoice.balance}. Thank you!`); }
  } catch (err) { logger.error('Invoice callback error', { message: err.message }); }
};

exports.getMyInvoices = async (req, res, next) => {
  try {
    const invoices = await Invoice.find({ client: req.user.clientId }).sort('-createdAt').limit(50);
    res.json(invoices);
  } catch (err) { next(err); }
};

exports.getOverdue = async (req, res, next) => {
  try {
    const filter = { status: { $in: ['SENT', 'PARTIAL'] }, dueDate: { $lt: new Date() } };
    if (req.user.role !== 'SUPER_ADMIN') filter.departmentSlug = req.user.departmentSlug;
    const invoices = await Invoice.find(filter).populate('client', 'fullName phone').sort('dueDate');
    res.json(invoices);
  } catch (err) { next(err); }
};

exports.cancelInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findByIdAndUpdate(req.params.id, { status: 'CANCELLED' }, { new: true });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    res.json(invoice);
  } catch (err) { next(err); }
};
