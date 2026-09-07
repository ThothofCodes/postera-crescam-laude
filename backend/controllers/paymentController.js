// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
const { validateCallback, isCallbackProcessed, markCallbackProcessed } = require('../middleware/mpesa');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Consultation = require('../models/Consultation');
const Revenue = require('../models/Revenue');
const { sendSMS } = require('../config/africastalking');
const { sendEmail } = require('../config/mailer');
const DeptTransaction = require('../models/DeptTransaction');
const { emitPaymentResult } = require('../socket');
const logger = require('../utils/logger');

const sanitizeRef = (r) => (r ? String(r).replace(/[^A-Z0-9]/gi, '').slice(0, 20) : undefined);

exports.mpesaCallback = async (req, res) => {
  // Always respond 200 immediately — Safaricom requires response within 5 seconds
  res.json({ ResultCode: 0, ResultDesc: 'Success' });

  try {
    // Validate callback structure before processing
    if (!req.body?.Body?.stkCallback) {
      logger.warn('[MPESA] Callback: invalid body structure');
      return;
    }

    const { resultCode, checkoutRequestId, meta } = validateCallback(req.body);

    // Validate checkoutRequestId format
    if (!checkoutRequestId || checkoutRequestId.length < 5 || checkoutRequestId.length > 100) {
      logger.warn(`[MPESA] Callback: invalid checkoutRequestId length (${checkoutRequestId?.length})`);
      return;
    }

    // ── Replay protection ──────────────────────────────────────
    if (isCallbackProcessed(checkoutRequestId)) {
      logger.warn(`[MPESA] Callback replay blocked: ${checkoutRequestId}`);
      return;
    }
    markCallbackProcessed(checkoutRequestId);

    // ── Log callback for audit trail ───────────────────────────
    const sourceIP = req.mpesaSourceInfo?.clientIP || 'unknown';
    logger.info(`[MPESA] Callback received: id=${checkoutRequestId} code=${resultCode} ip=${sourceIP} safaricom=${req.mpesaSourceInfo?.isFromSafaricom}`);

    const order = await Order.findOne({ checkoutRequestId });
    const consultation = !order ? await Consultation.findOne({ checkoutRequestId }).populate('client') : null;
    const record = order || consultation;
    if (!record) {
      logger.warn(`[MPESA] Callback: no order/consultation found for ${checkoutRequestId}`);
      return;
    }

    // Prevent replay — only process if still unpaid
    if (record.paymentStatus === 'paid') {
      logger.warn(`[MPESA] Callback: already paid ${checkoutRequestId}`);
      return;
    }

    if (resultCode === 0) {
      const mpesaRef = sanitizeRef(meta.MpesaReceiptNumber);
      record.paymentStatus = 'paid';
      record.mpesaRef = mpesaRef;
      await record.save();

      const isOrder = !!order;
      await Revenue.create({
        type: 'income',
        category: isOrder ? 'order' : 'consultation',
        description: isOrder ? `Order ${order.orderNumber}` : `Consultation ${consultation._id}`,
        amount: isOrder ? order.total : consultation.fee,
        paymentMethod: 'mpesa',
        reference: mpesaRef,
      });

      // Record department transaction for analytics
      try {
        await DeptTransaction.create({
          type: 'income',
          amount: isOrder ? order.total : consultation.fee,
          departmentSlug: isOrder ? 'store' : 'consultations',
          description: isOrder ? `Order ${order.orderNumber} — M-Pesa` : `Consultation ${consultation._id} — M-Pesa`,
          reference: mpesaRef,
        });
      } catch { /* DeptTransaction recording is non-critical */ }

      // Deduct stock for physical products (bulk update for atomicity)
      if (isOrder && order.items?.length) {
        const stockUpdates = order.items
          .filter((item) => item.product)
          .map((item) => Product.findByIdAndUpdate(
            item.product,
            { $inc: { soldCount: item.quantity, stock: -item.quantity } },
            { runValidators: true },
          ));
        await Promise.all(stockUpdates);
      }

      // Emit real-time payment status via Socket.io
      emitPaymentResult(checkoutRequestId, {
        success: true,
        orderNumber: isOrder ? order.orderNumber : null,
        amount: isOrder ? order.total : consultation.fee,
        mpesaRef,
        paymentStatus: 'paid',
      });

      if (isOrder) {
        const notifyTo = order.customer.email || order.customer.phone;
        if (notifyTo) sendSMS(notifyTo, `Payment of KES ${order.total} confirmed. Ref: ${mpesaRef}. Order: ${order.orderNumber}`);
        // Send email receipt if customer email is available
        if (order.customer.email) {
          sendEmail({
            to: order.customer.email,
            subject: `✅ Payment Confirmed — Order ${order.orderNumber}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #0d9488; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                  <h1 style="margin: 0; font-size: 24px;">✅ Payment Confirmed!</h1>
                </div>
                <div style="padding: 20px; background: #f8fafc; border: 1px solid #e2e8f0;">
                  <p>Hello ${order.customer.name},</p>
                  <p>Your payment for <strong>Order ${order.orderNumber}</strong> has been confirmed.</p>
                  <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <p><strong>Amount:</strong> KES ${order.total.toLocaleString()}</p>
                    <p><strong>M-Pesa Ref:</strong> ${mpesaRef}</p>
                    <p><strong>Order Number:</strong> ${order.orderNumber}</p>
                  </div>
                  <p>We'll notify you when your order is ready for pickup/delivery.</p>
                  <p style="color: #64748b; font-size: 12px;">Thank you for shopping with Postera Crescam Laude!</p>
                </div>
              </div>
            `,
          }).catch(() => {});
        }
      } else if (consultation?.client?.email || consultation?.client?.phone) {
        const notifyTo = consultation.client.email || consultation.client.phone;
        if (notifyTo) sendSMS(notifyTo, `Consultation payment of KES ${consultation.fee} confirmed. Ref: ${mpesaRef}.`);
      }
    } else {
      logger.info(`M-Pesa callback: payment failed for ${checkoutRequestId} — ResultCode: ${resultCode}`);
      // Emit failure so frontend can show retry options immediately
      emitPaymentResult(checkoutRequestId, {
        success: false,
        resultCode,
        message: 'Payment was not completed',
        paymentStatus: 'failed',
      });
      // Notify customer of failed payment
      const failedPhone = order?.customer?.phone || consultation?.client?.phone;
      const failedEmail = order?.customer?.email;
      const failedName = order?.customer?.name || 'Customer';
      const failedAmount = order?.total || consultation?.fee || 0;
      const failedNotifyTo = failedEmail || failedPhone;
      if (failedNotifyTo) {
        sendSMS(failedNotifyTo, `Payment of KES ${failedAmount} could not be completed. Please retry or contact us for assistance.`);
      }
      if (failedEmail) {
        sendEmail({
          to: failedEmail,
          subject: `⚠️ Payment Not Completed — Order ${order?.orderNumber || 'N/A'}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="margin: 0; font-size: 24px;">⚠️ Payment Not Completed</h1>
              </div>
              <div style="padding: 20px; background: #f8fafc; border: 1px solid #e2e8f0;">
                <p>Hello ${failedName},</p>
                <p>Your payment of <strong>KES ${failedAmount.toLocaleString()}</strong> for Order ${order?.orderNumber || 'N/A'} could not be completed.</p>
                <p>This can happen if:</p>
                <ul>
                  <li>The M-Pesa prompt expired</li>
                  <li>The transaction was cancelled</li>
                  <li>There was a network issue</li>
                </ul>
                <p>Please try again or contact our support team for assistance.</p>
                <p style="color: #64748b; font-size: 12px;">Postera Crescam Laude Support</p>
              </div>
            </div>
          `,
        }).catch(() => {});
      }
    }
  } catch (err) {
    logger.error('M-Pesa callback processing error', { message: err.message });
  }
};
