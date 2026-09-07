// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// Promo Code model — discount codes, referral codes, and promotional campaigns.
// Each code tracks usage, revenue generated, and conversion rates.

const mongoose = require('mongoose');

const PromoCodeSchema = new mongoose.Schema({
  // ── Code identity ────────────────────────────────────────────────────────
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  description: { type: String, trim: true },

  // ── Discount configuration ───────────────────────────────────────────────
  type: {
    type: String,
    enum: ['percentage', 'fixed_amount', 'free_shipping', 'buy_x_get_y'],
    required: true,
  },
  value: { type: Number, required: true, min: 0 }, // Percentage (0-100) or fixed amount (KES)
  maxDiscount: { type: Number }, // Cap for percentage discounts (KES)
  minOrderAmount: { type: Number, default: 0 }, // Minimum order to apply discount
  currency: { type: String, default: 'KES' },

  // ── Scope ────────────────────────────────────────────────────────────────
  appliesTo: {
    type: String,
    enum: ['all', 'products', 'services', 'orders', 'bookings', 'consultations'],
    default: 'all',
  },
  applicableItems: [{ type: mongoose.Schema.Types.ObjectId }], // Specific product/service IDs
  excludeItems: [{ type: mongoose.Schema.Types.ObjectId }], // Items excluded from discount
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' }, // Dept-scoped codes

  // ── Usage limits ─────────────────────────────────────────────────────────
  usageLimit: { type: Number }, // Max total uses (null = unlimited)
  usageCount: { type: Number, default: 0 },
  perUserLimit: { type: Number, default: 1 }, // Max uses per user

  // ── Scheduling ───────────────────────────────────────────────────────────
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  isActive: { type: Boolean, default: true },

  // ── Tracking ─────────────────────────────────────────────────────────────
  totalDiscountGiven: { type: Number, default: 0 }, // Total KES discount applied
  totalRevenueGenerated: { type: Number, default: 0 }, // Revenue from orders using this code
  convertedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Users who used code

  // ── Referral system ──────────────────────────────────────────────────────
  isReferralCode: { type: Boolean, default: false },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Who owns this referral code
  referralReward: { type: Number, default: 0 }, // KES reward to referrer per conversion
  referralRewardPaid: { type: Number, default: 0 }, // KES already paid out

  // ── Ownership ────────────────────────────────────────────────────────────
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Indexes (code index auto-created by unique: true in schema)
PromoCodeSchema.index({ isActive: 1, startDate: 1, endDate: 1 });
PromoCodeSchema.index({ isReferralCode: 1, referredBy: 1 });

module.exports = mongoose.model('PromoCode', PromoCodeSchema);
