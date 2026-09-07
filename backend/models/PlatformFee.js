// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// Platform Fee model — tracks automated commissions on every revenue-generating transaction.
// Each fee entry is created automatically when an order, booking, or consultation is paid.

const mongoose = require('mongoose');

const PlatformFeeSchema = new mongoose.Schema({
  // ── Fee identity ─────────────────────────────────────────────────────────
  sourceType: {
    type: String,
    enum: ['order', 'booking', 'consultation', 'invoice', 'subscription', 'ad_campaign', 'other'],
    required: true,
  },
  sourceId: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'sourceModel' },
  sourceModel: {
    type: String,
    required: true,
    enum: ['Order', 'Booking', 'Consultation', 'Invoice', 'AdCampaign'],
  },

  // ── Fee calculation ──────────────────────────────────────────────────────
  grossAmount: { type: Number, required: true, min: 0 }, // Total transaction amount (KES)
  feePercentage: {
    type: Number, required: true, min: 0, max: 100,
  }, // Platform fee %
  feeAmount: { type: Number, required: true, min: 0 }, // Calculated fee in KES
  netAmount: { type: Number, required: true, min: 0 }, // Amount after fee deduction (KES)
  currency: { type: String, default: 'KES' },

  // ── Revenue attribution ──────────────────────────────────────────────────
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  departmentSlug: { type: String },
  category: { type: String }, // Product category, service type, etc.

  // ── Payment tracking ─────────────────────────────────────────────────────
  paymentMethod: { type: String, enum: ['mpesa', 'cash', 'bank', 'auto'] },
  paymentReference: String, // M-Pesa receipt, bank ref, etc.
  collectedAt: { type: Date, default: Date.now },

  // ── Status ───────────────────────────────────────────────────────────────
  status: {
    type: String,
    enum: ['pending', 'collected', 'refunded', 'disputed'],
    default: 'collected',
  },

  // ── Metadata ─────────────────────────────────────────────────────────────
  description: String,
  notes: String,
}, { timestamps: true });

// Indexes for reporting
PlatformFeeSchema.index({ sourceType: 1, sourceId: 1 });
PlatformFeeSchema.index({ collectedAt: 1 });
PlatformFeeSchema.index({ department: 1, collectedAt: 1 });
PlatformFeeSchema.index({ status: 1 });

module.exports = mongoose.model('PlatformFee', PlatformFeeSchema);
