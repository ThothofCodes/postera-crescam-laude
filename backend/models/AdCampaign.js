// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// Ad Campaign model — manages sponsored content, banner ads, and promoted articles on the Tech Hub.
// Advertisers pay to display ads; revenue is tracked automatically.

const mongoose = require('mongoose');

const AdCampaignSchema = new mongoose.Schema({
  // ── Campaign identity ────────────────────────────────────────────────────
  name: { type: String, required: true, trim: true },
  advertiser: { type: String, required: true, trim: true }, // Company/person name
  contactEmail: { type: String, trim: true },
  contactPhone: { type: String, trim: true },

  // ── Ad content ───────────────────────────────────────────────────────────
  type: {
    type: String,
    enum: ['banner', 'sponsored_article', 'inline_text', 'popup', 'sidebar'],
    required: true,
  },
  title: { type: String, required: true, trim: true },
  body: { type: String }, // HTML/markdown content
  imageUrl: { type: String }, // Banner image URL
  linkUrl: { type: String }, // Click-through URL
  ctaText: { type: String, default: 'Learn More' }, // Call-to-action button text

  // ── Targeting ────────────────────────────────────────────────────────────
  position: {
    type: String,
    enum: ['top', 'bottom', 'sidebar', 'inline', 'popup', 'footer'],
    default: 'sidebar',
  },
  targetPages: [{ type: String }], // e.g. ['tech-hub', 'store', 'all']
  targetAudience: {
    type: String,
    enum: ['all', 'logged_in', 'new_visitors', 'returning'],
    default: 'all',
  },

  // ── Scheduling ───────────────────────────────────────────────────────────
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: {
    type: String,
    enum: ['draft', 'pending_payment', 'active', 'paused', 'completed', 'cancelled'],
    default: 'draft',
  },

  // ── Pricing ──────────────────────────────────────────────────────────────
  pricingModel: {
    type: String,
    enum: ['cpm', 'cpc', 'flat_rate', 'free'],
    default: 'flat_rate',
  },
  budget: { type: Number, default: 0 }, // Total budget in KES
  spent: { type: Number, default: 0 }, // Amount spent so far
  costPerImpression: { type: Number, default: 0 }, // KES per 1000 impressions
  costPerClick: { type: Number, default: 0 }, // KES per click
  currency: { type: String, default: 'KES' },

  // ── Performance tracking ─────────────────────────────────────────────────
  impressions: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  conversions: { type: Number, default: 0 },

  // ── Payment ──────────────────────────────────────────────────────────────
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'partial', 'paid'],
    default: 'unpaid',
  },
  paymentMethod: { type: String, enum: ['mpesa', 'cash', 'bank', 'free'] },
  mpesaRef: String,

  // ── Ownership ────────────────────────────────────────────────────────────
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
}, { timestamps: true });

// Indexes for active ad lookups
AdCampaignSchema.index({ status: 1, startDate: 1, endDate: 1 });
AdCampaignSchema.index({ type: 1, status: 1 });

module.exports = mongoose.model('AdCampaign', AdCampaignSchema);
