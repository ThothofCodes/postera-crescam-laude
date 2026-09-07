// Copyright (c) 2026 Thoth of Codes. Recurring billing renewal jobs
const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const ISPClient = require('../models/ISPClient');
const { sendSMS } = require('../config/africastalking');

exports.runBillingRenewals = async function () {
  if (mongoose.connection.readyState !== 1) return;
  try {
    const now = new Date();
    const in3days = new Date(now.getTime() + 3 * 86400000);

    // Internet — clients with cycleEnd within 3 days
    const dueISP = await ISPClient.find({ cycleEnd: { $lte: in3days, $gte: now }, status: 'active' });
    for (const isp of dueISP) {
      const exists = await Invoice.findOne({ clientId: isp._id, status: { $in: ['DRAFT', 'SENT'] } });
      if (!exists) {
        await Invoice.create({
          clientId: isp._id,
          departmentSlug: 'internet',
          lineItems: [{
            description: `${isp.packageName} Renewal`, qty: 1, unitPrice: isp.monthlyFee, total: isp.monthlyFee,
          }],
          totalAmount: isp.monthlyFee,
          balance: isp.monthlyFee,
          status: 'DRAFT',
          dueDate: isp.cycleEnd,
          invoiceId: `RTS-INT-${Date.now()}`,
        });
        try { const notifyTo = isp.email || isp.phone; if (notifyTo) await sendSMS(notifyTo, `Hi ${isp.name}, your PCL internet package renews on ${isp.cycleEnd?.toDateString()}. Amount: KES ${isp.monthlyFee}. Pay via M-Pesa Paybill 522522 Acc: ${isp.phone}.`); } catch (_) {}
      }
    }
    console.log(`[CRON] BillingRenewals: ${dueISP.length} ISP renewals processed`);
  } catch (err) {
    console.error('[CRON] BillingRenewals error:', err.message);
  }
};
