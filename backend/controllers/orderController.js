// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
const Order = require('../models/Order');
const Product = require('../models/Product');
const Revenue = require('../models/Revenue');
const { stkPush } = require('../middleware/mpesa');
const { sendSMS } = require('../config/africastalking');
const { invalidateMultiple } = require('../middleware/cache');
const logger = require('../utils/logger');

// Zod validates: ID format, status enums, payment enums, body shape, query params
// Controllers only handle business logic and database operations

exports.getOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, paymentStatus } = req.query;
    const query = {};
    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    const [orders, total] = await Promise.all([
      Order.find(query).sort('-createdAt').skip((page - 1) * limit).limit(limit),
      Order.countDocuments(query),
    ]);
    res.json({ orders, total, page, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
};

exports.getOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate('items.product', 'name images');
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (err) { next(err); }
};

exports.getOrdersByPhone = async (req, res, next) => {
  try {
    const orders = await Order.find({ 'customer.phone': req.params.phone })
      .sort('-createdAt')
      .select('orderNumber status paymentStatus total deliveryType items createdAt mpesaRef customer.name customer.phone');
    res.json(orders);
  } catch (err) { next(err); }
};

exports.createOrder = async (req, res, next) => {
  try {
    const { items, customer, deliveryType, deliveryFee = 0, notes, paymentMethod } = req.body;
    const phone = customer.phone.replace(/\D/g, '');

    // Business validation: check product availability and stock
    const enriched = await Promise.all(items.map(async ({ product, quantity }) => {
      const p = await Product.findById(product);
      if (!p || !p.isActive) throw Object.assign(new Error('Product unavailable'), { statusCode: 400 });
      if (!p.isDigital && p.stock < quantity) throw Object.assign(new Error(`Insufficient stock for ${p.name}`), { statusCode: 400 });
      return { product: p._id, name: p.name, price: p.price, quantity, subtotal: p.price * quantity };
    }));

    const subtotal = enriched.reduce((s, i) => s + i.subtotal, 0);
    const total = subtotal + (deliveryFee || 0);

    const order = await Order.create({
      customer: {
        name: customer.name.trim(),
        phone,
        email: customer.email?.toLowerCase().trim(),
        deliveryAddress: customer.deliveryAddress?.trim(),
      },
      items: enriched,
      subtotal,
      deliveryFee: deliveryFee || 0,
      total,
      deliveryType: deliveryType || 'pickup',
      notes: notes?.trim(),
      paymentMethod: paymentMethod || 'cash',
    });

    if (paymentMethod === 'mpesa') {
      try {
        const stkPushResult = await stkPush(phone, total, order.orderNumber, 'PCL Order');
        order.checkoutRequestId = stkPushResult.CheckoutRequestID;
        await order.save();
      } catch (e) {
        logger.error('STK Push failed', { message: e.message });
        return res.status(201).json({
          ...order.toObject(),
          _stkError: e.message || 'M-Pesa prompt could not be sent. Please try again or pay cash.',
        });
      }
    }

    invalidateMultiple(['products', 'admin:stats', 'admin:revenue', 'analytics']).catch(() => {});
    const notifyTo = customer.email || phone;
    if (notifyTo) sendSMS(notifyTo, `Order ${order.orderNumber} placed! Total: KES ${total}. We'll confirm shortly.`);
    res.status(201).json(order);
  } catch (err) { next(err); }
};

exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const ts = { confirmed: 'confirmedAt', shipped: 'shippedAt', delivered: 'deliveredAt' };
    const update = { status };
    if (ts[status]) update[ts[status]] = new Date();
    const order = await Order.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    const notifyTo = order.customer.email || order.customer.phone;
    if (notifyTo) sendSMS(notifyTo, `Your order ${order.orderNumber} is now: ${status.toUpperCase()}.`);
    res.json(order);
  } catch (err) { next(err); }
};

exports.recordOrderPayment = async (req, res, next) => {
  try {
    const { paymentMethod, mpesaRef, amount } = req.body;
    const safeRef = mpesaRef ? mpesaRef.replace(/[^A-Z0-9]/gi, '').slice(0, 20) : undefined;
    const order = await Order.findByIdAndUpdate(req.params.id, { paymentStatus: 'paid', paymentMethod, mpesaRef: safeRef }, { new: true });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    await Revenue.create({
      type: 'income', category: 'order', description: `Order ${order.orderNumber} — ${order.customer.name}`,
      amount, paymentMethod, reference: safeRef, createdBy: req.user._id,
    });
    // Record platform fee for monetization tracking
    const { recordFee } = require('../controllers/monetizationController');
    recordFee({
      sourceType: 'order', sourceId: order._id, sourceModel: 'Order',
      grossAmount: amount, department: order.department, category: 'order',
      paymentMethod, paymentReference: safeRef,
      description: `Order ${order.orderNumber}`,
    }).catch(() => {}); // Non-blocking
    await Promise.all(order.items.map(async ({ product, quantity }) => {
      const p = await Product.findById(product);
      if (p && !p.isDigital) await Product.findByIdAndUpdate(product, { $inc: { soldCount: quantity, stock: -quantity } });
      else if (p) await Product.findByIdAndUpdate(product, { $inc: { soldCount: quantity } });
    }));
    invalidateMultiple(['products', 'admin:stats', 'admin:revenue', 'analytics', 'deptAnalytics']).catch(() => {});
    const notifyTo = order.customer.email || order.customer.phone;
    if (notifyTo) sendSMS(notifyTo, `Payment confirmed for order ${order.orderNumber}. Ref: ${safeRef || 'N/A'}. Thank you!`);
    res.json(order);
  } catch (err) { next(err); }
};

exports.sendStkPush = async (req, res, next) => {
  try {
    const { identifier } = req.params;
    const query = /^[0-9a-fA-F]{24}$/.test(identifier) ? { _id: identifier } : { orderNumber: identifier };
    const order = await Order.findOne(query);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.paymentMethod !== 'mpesa') return res.status(400).json({ message: 'This order is not set up for M-Pesa payment' });
    if (order.paymentStatus === 'paid') return res.status(400).json({ message: 'This order is already paid' });
    if ((order.retryCount || 0) >= 3) return res.status(429).json({ message: 'Maximum retry attempts reached' });
    if (order.lastRetryAt && Date.now() - new Date(order.lastRetryAt).getTime() < 30000) {
      const waitSec = Math.ceil((30000 - (Date.now() - new Date(order.lastRetryAt).getTime())) / 1000);
      return res.status(429).json({ message: `Please wait ${waitSec} seconds before retrying` });
    }
    const phone = order.customer.phone.replace(/\D/g, '');
    const result = await stkPush(phone, order.total, order.orderNumber, 'PCL Order');
    order.checkoutRequestId = result.CheckoutRequestID;
    order.retryCount = (order.retryCount || 0) + 1;
    order.lastRetryAt = new Date();
    await order.save();
    res.json({ success: true, message: `M-Pesa prompt sent to ${phone}`, checkoutRequestId: result.CheckoutRequestID, retryCount: order.retryCount });
  } catch (err) { logger.error('sendStkPush error', { message: err.message }); next(err); }
};

// Public retry for unauthenticated checkout — same logic as sendStkPush but no auth required
exports.publicRetryStkPush = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.paymentMethod !== 'mpesa') return res.status(400).json({ message: 'Not an M-Pesa order' });
    if (order.paymentStatus === 'paid') return res.status(400).json({ message: 'Already paid' });
    if ((order.retryCount || 0) >= 3) return res.status(429).json({ message: 'Maximum retries reached' });
    if (order.lastRetryAt && Date.now() - new Date(order.lastRetryAt).getTime() < 30000) {
      const waitSec = Math.ceil((30000 - (Date.now() - new Date(order.lastRetryAt).getTime())) / 1000);
      return res.status(429).json({ message: `Please wait ${waitSec}s before retrying` });
    }
    const phone = order.customer.phone.replace(/\D/g, '');
    const result = await stkPush(phone, order.total, order.orderNumber, 'PCL Order');
    order.checkoutRequestId = result.CheckoutRequestID;
    order.retryCount = (order.retryCount || 0) + 1;
    order.lastRetryAt = new Date();
    await order.save();
    res.json({ success: true, message: `M-Pesa prompt sent to ${phone}`, checkoutRequestId: result.CheckoutRequestID, retryCount: order.retryCount, orderNumber: order.orderNumber });
  } catch (err) { logger.error('publicRetryStkPush error', { message: err.message }); next(err); }
};

// Public order status — used by PaymentForm polling after checkout
exports.getOrderStatus = async (req, res, next) => {
  try {
    const { identifier } = req.params;
    const query = /^[0-9a-fA-F]{24}$/.test(identifier) ? { _id: identifier } : { orderNumber: identifier };
    const order = await Order.findOne(query).select('orderNumber paymentStatus paymentMethod total status');
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json({ orderNumber: order.orderNumber, paymentStatus: order.paymentStatus, paymentMethod: order.paymentMethod, total: order.total, status: order.status });
  } catch (err) { next(err); }
};

// Public receipt lookup by order number
exports.getReceiptByOrderNumber = async (req, res, next) => {
  try {
    const order = await Order.findOne({ orderNumber: req.params.orderNumber })
      .select('orderNumber status paymentStatus paymentMethod total subtotal deliveryFee deliveryType items customer createdAt mpesaRef checkoutRequestId');
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (err) { next(err); }
};

// Public switch to cash on pickup
exports.switchToCash = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.paymentStatus === 'paid') return res.status(400).json({ message: 'Already paid' });
    order.paymentMethod = 'cash';
    order.paymentStatus = 'unpaid';
    await order.save();
    res.json({ success: true, message: 'Switched to Cash on Pickup', orderNumber: order.orderNumber, amount: order.total });
  } catch (err) { next(err); }
};
