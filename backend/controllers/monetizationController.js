// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// Monetization controller — ad campaigns, promo codes, platform fees, and unified revenue dashboard.

const AdCampaign = require('../models/AdCampaign');
const PromoCode = require('../models/PromoCode');
const PlatformFee = require('../models/PlatformFee');
const Order = require('../models/Order');
const Booking = require('../models/Booking');
const Consultation = require('../models/Consultation');
const { invalidateMultiple } = require('../middleware/cache');
const logger = require('../utils/logger');

// ── Default platform fee percentage ────────────────────────────────────────
const DEFAULT_FEE_PERCENTAGE = parseFloat(process.env.PLATFORM_FEE_PERCENTAGE || '5');

// ════════════════════════════════════════════════════════════════════════════
//  AD CAMPAIGNS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Create a new ad campaign.
 */
exports.createCampaign = async (req, res) => {
  try {
    const campaign = await AdCampaign.create({
      ...req.body,
      createdBy: req.user._id,
      department: req.user.department,
    });
    res.status(201).json({ message: 'Campaign created', campaign });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * List ad campaigns with filtering.
 */
exports.getCampaigns = async (req, res) => {
  try {
    const {
      status, type, page = 1, limit = 20,
    } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [campaigns, total] = await Promise.all([
      AdCampaign.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .lean(),
      AdCampaign.countDocuments(filter),
    ]);

    res.json({
      campaigns,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / parseInt(limit, 10)),
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Update an ad campaign.
 */
exports.updateCampaign = async (req, res) => {
  try {
    const campaign = await AdCampaign.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true },
    );
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    res.json({ message: 'Campaign updated', campaign });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Delete an ad campaign.
 */
exports.deleteCampaign = async (req, res) => {
  try {
    const campaign = await AdCampaign.findByIdAndDelete(req.params.id);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    res.json({ message: 'Campaign deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Track ad impression (called when ad is displayed).
 */
exports.trackImpression = async (req, res) => {
  try {
    const { campaignId } = req.body;
    const campaign = await AdCampaign.findByIdAndUpdate(
      campaignId,
      { $inc: { impressions: 1 } },
      { new: true },
    );
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });

    // Calculate CPM cost
    if (campaign.pricingModel === 'cpm' && campaign.costPerImpression > 0) {
      const impressionCost = campaign.costPerImpression / 1000;
      campaign.spent += impressionCost;
      if (campaign.spent >= campaign.budget && campaign.budget > 0) {
        campaign.status = 'completed';
      }
      await campaign.save();
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Track ad click (called when ad is clicked).
 */
exports.trackClick = async (req, res) => {
  try {
    const { campaignId } = req.body;
    const campaign = await AdCampaign.findByIdAndUpdate(
      campaignId,
      { $inc: { clicks: 1 } },
      { new: true },
    );
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });

    // Calculate CPC cost
    if (campaign.pricingModel === 'cpc' && campaign.costPerClick > 0) {
      campaign.spent += campaign.costPerClick;
      if (campaign.spent >= campaign.budget && campaign.budget > 0) {
        campaign.status = 'completed';
      }
      await campaign.save();
    }

    res.json({ ok: true, linkUrl: campaign.linkUrl });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Get active ads for a page (public endpoint for the frontend).
 */
exports.getActiveAds = async (req, res) => {
  try {
    const { page = 'all', position } = req.query;
    const now = new Date();

    const filter = {
      status: 'active',
      startDate: { $lte: now },
      endDate: { $gte: now },
    };

    // Position filter
    if (position) filter.position = position;

    // Page targeting
    filter.$or = [
      { targetPages: { $in: ['all', page] } },
      { targetPages: { $size: 0 } }, // Empty = all pages
    ];

    const ads = await AdCampaign.find(filter)
      .select('title body imageUrl linkUrl ctaText type position pricingModel impressions')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    res.json({ ads });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════════════════
//  PROMO CODES
// ════════════════════════════════════════════════════════════════════════════

/**
 * Create a promo code.
 */
exports.createPromoCode = async (req, res) => {
  try {
    const { code } = req.body;
    // Check uniqueness
    const existing = await PromoCode.findOne({ code: code.toUpperCase() });
    if (existing) {
      return res.status(409).json({ message: 'Promo code already exists' });
    }

    const promo = await PromoCode.create({
      ...req.body,
      code: code.toUpperCase(),
      createdBy: req.user._id,
    });
    res.status(201).json({ message: 'Promo code created', promo });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * List promo codes with filtering.
 */
exports.getPromoCodes = async (req, res) => {
  try {
    const {
      isActive, isReferralCode, page = 1, limit = 20,
    } = req.query;
    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (isReferralCode !== undefined) filter.isReferralCode = isReferralCode === 'true';

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [promos, total] = await Promise.all([
      PromoCode.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .populate('createdBy', 'name email')
        .lean(),
      PromoCode.countDocuments(filter),
    ]);

    res.json({
      promos,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / parseInt(limit, 10)),
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Validate a promo code and return discount details.
 * Called by the frontend before checkout.
 */
exports.validatePromoCode = async (req, res) => {
  try {
    const { code, orderAmount = 0, itemType = 'all' } = req.body;
    if (!code) return res.status(400).json({ message: 'Code is required' });

    const promo = await PromoCode.findOne({
      code: code.toUpperCase(),
      isActive: true,
    });

    if (!promo) {
      return res.status(404).json({ message: 'Invalid promo code', valid: false });
    }

    // Check date range
    const now = new Date();
    if (now < promo.startDate || now > promo.endDate) {
      return res.status(400).json({ message: 'Promo code has expired', valid: false });
    }

    // Check usage limit
    if (promo.usageLimit && promo.usageCount >= promo.usageLimit) {
      return res.status(400).json({ message: 'Promo code usage limit reached', valid: false });
    }

    // Check minimum order
    if (orderAmount < promo.minOrderAmount) {
      return res.status(400).json({
        message: `Minimum order amount is KES ${promo.minOrderAmount}`,
        valid: false,
      });
    }

    // Check scope
    if (promo.appliesTo !== 'all' && promo.appliesTo !== itemType) {
      return res.status(400).json({ message: 'Promo code not applicable to this item', valid: false });
    }

    // Calculate discount
    let discount = 0;
    if (promo.type === 'percentage') {
      discount = (orderAmount * promo.value) / 100;
      if (promo.maxDiscount) discount = Math.min(discount, promo.maxDiscount);
    } else if (promo.type === 'fixed_amount') {
      discount = Math.min(promo.value, orderAmount);
    } else if (promo.type === 'free_shipping') {
      discount = 0; // Shipping cost handled at checkout
    }

    res.json({
      valid: true,
      code: promo.code,
      type: promo.type,
      value: promo.value,
      discount: Math.round(discount * 100) / 100,
      description: promo.description,
      maxDiscount: promo.maxDiscount,
      freeShipping: promo.type === 'free_shipping',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Update a promo code.
 */
exports.updatePromoCode = async (req, res) => {
  try {
    const promo = await PromoCode.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true },
    );
    if (!promo) return res.status(404).json({ message: 'Promo code not found' });
    res.json({ message: 'Promo code updated', promo });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Delete a promo code.
 */
exports.deletePromoCode = async (req, res) => {
  try {
    const promo = await PromoCode.findByIdAndDelete(req.params.id);
    if (!promo) return res.status(404).json({ message: 'Promo code not found' });
    res.json({ message: 'Promo code deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Apply promo code to an order (called during checkout).
 * Returns the discount amount and updates usage stats.
 */
exports.applyPromoCode = async (code, orderAmount, userId, itemType = 'all') => {
  const promo = await PromoCode.findOne({
    code: code.toUpperCase(),
    isActive: true,
  });

  if (!promo) return { valid: false, error: 'Invalid promo code' };

  const now = new Date();
  if (now < promo.startDate || now > promo.endDate) {
    return { valid: false, error: 'Promo code has expired' };
  }

  if (promo.usageLimit && promo.usageCount >= promo.usageLimit) {
    return { valid: false, error: 'Usage limit reached' };
  }

  if (orderAmount < promo.minOrderAmount) {
    return { valid: false, error: `Minimum order: KES ${promo.minOrderAmount}` };
  }

  if (promo.appliesTo !== 'all' && promo.appliesTo !== itemType) {
    return { valid: false, error: 'Code not applicable to this item' };
  }

  // Calculate discount
  let discount = 0;
  if (promo.type === 'percentage') {
    discount = (orderAmount * promo.value) / 100;
    if (promo.maxDiscount) discount = Math.min(discount, promo.maxDiscount);
  } else if (promo.type === 'fixed_amount') {
    discount = Math.min(promo.value, orderAmount);
  }

  // Update usage
  promo.usageCount += 1;
  promo.totalDiscountGiven += discount;
  promo.totalRevenueGenerated += orderAmount;
  if (userId) promo.convertedUsers.addToSet(userId);
  await promo.save();

  // Handle referral reward
  if (promo.isReferralCode && promo.referredBy && promo.referralReward > 0) {
    // Referral reward is tracked but paid out manually
    logger.info(`Referral reward earned: KES ${promo.referralReward} for user ${promo.referredBy}`);
  }

  return {
    valid: true,
    code: promo.code,
    discount: Math.round(discount * 100) / 100,
    freeShipping: promo.type === 'free_shipping',
  };
};

// ════════════════════════════════════════════════════════════════════════════
//  PLATFORM FEES
// ════════════════════════════════════════════════════════════════════════════

/**
 * Record a platform fee from a transaction.
 * Called automatically when orders, bookings, or consultations are paid.
 */
exports.recordFee = async ({
  sourceType, sourceId, sourceModel, grossAmount,
  department, departmentSlug, category, paymentMethod,
  paymentReference, description,
}) => {
  try {
    const feePercentage = DEFAULT_FEE_PERCENTAGE;
    const feeAmount = Math.round(((grossAmount * feePercentage) / 100) * 100) / 100;
    const netAmount = Math.round((grossAmount - feeAmount) * 100) / 100;

    const fee = await PlatformFee.create({
      sourceType,
      sourceId,
      sourceModel,
      grossAmount,
      feePercentage,
      feeAmount,
      netAmount,
      department,
      departmentSlug,
      category,
      paymentMethod: paymentMethod || 'auto',
      paymentReference,
      description,
    });

    logger.info(`Platform fee recorded: KES ${feeAmount} from ${sourceType}`, {
      sourceId,
      grossAmount,
      feePercentage,
    });

    // Invalidate monetization caches
    invalidateMultiple(['monetization', 'admin:stats', 'admin:revenue']).catch(() => {});

    return fee;
  } catch (err) {
    logger.error('Failed to record platform fee', { message: err.message });
    return null;
  }
};

/**
 * Get platform fee summary for dashboard.
 */
exports.getFeeSummary = async (req, res) => {
  try {
    const { startDate, endDate, department } = req.query;
    const filter = { status: 'collected' };

    if (startDate || endDate) {
      filter.collectedAt = {};
      if (startDate) filter.collectedAt.$gte = new Date(startDate);
      if (endDate) filter.collectedAt.$lte = new Date(endDate);
    }
    if (department) filter.department = department;

    const [summary, bySource, byDepartment] = await Promise.all([
      PlatformFee.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalGross: { $sum: '$grossAmount' },
            totalFees: { $sum: '$feeAmount' },
            totalNet: { $sum: '$netAmount' },
            transactionCount: { $sum: 1 },
            avgFee: { $avg: '$feeAmount' },
          },
        },
      ]),
      PlatformFee.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$sourceType',
            gross: { $sum: '$grossAmount' },
            fees: { $sum: '$feeAmount' },
            net: { $sum: '$netAmount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { fees: -1 } },
      ]),
      PlatformFee.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$departmentSlug',
            gross: { $sum: '$grossAmount' },
            fees: { $sum: '$feeAmount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { fees: -1 } },
      ]),
    ]);

    res.json({
      summary: summary[0] || {
        totalGross: 0,
        totalFees: 0,
        totalNet: 0,
        transactionCount: 0,
        avgFee: 0,
      },
      bySource,
      byDepartment,
      feePercentage: DEFAULT_FEE_PERCENTAGE,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Get recent platform fee transactions.
 */
exports.getFeeTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 20, sourceType } = req.query;
    const filter = {};
    if (sourceType) filter.sourceType = sourceType;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [transactions, total] = await Promise.all([
      PlatformFee.find(filter)
        .sort({ collectedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .lean(),
      PlatformFee.countDocuments(filter),
    ]);

    res.json({
      transactions,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / parseInt(limit, 10)),
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════════════════
//  MONETIZATION DASHBOARD
// ════════════════════════════════════════════════════════════════════════════

/**
 * Unified monetization dashboard — all revenue streams in one view.
 */
exports.getDashboard = async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      // Ad campaign stats
      activeCampaigns,
      totalAdRevenue,
      totalImpressions,
      totalClicks,

      // Promo code stats
      activePromos,
      totalDiscountGiven,
      totalPromoRevenue,

      // Platform fee stats
      feeStats,
      recentFees,

      // Product/service revenue
      productRevenue,
      bookingRevenue,
      consultationRevenue,
    ] = await Promise.all([
      // Ad campaigns
      AdCampaign.countDocuments({ status: 'active' }),
      AdCampaign.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: null, total: { $sum: '$spent' } } },
      ]),
      AdCampaign.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: null, total: { $sum: '$impressions' } } },
      ]),
      AdCampaign.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: null, total: { $sum: '$clicks' } } },
      ]),

      // Promo codes
      PromoCode.countDocuments({ isActive: true }),
      PromoCode.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: null, total: { $sum: '$totalDiscountGiven' } } },
      ]),
      PromoCode.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: null, total: { $sum: '$totalRevenueGenerated' } } },
      ]),

      // Platform fees
      PlatformFee.aggregate([
        { $match: { collectedAt: { $gte: thirtyDaysAgo }, status: 'collected' } },
        {
          $group: {
            _id: null,
            totalGross: { $sum: '$grossAmount' },
            totalFees: { $sum: '$feeAmount' },
            count: { $sum: 1 },
          },
        },
      ]),
      PlatformFee.find({ collectedAt: { $gte: sevenDaysAgo } })
        .sort({ collectedAt: -1 })
        .limit(10)
        .lean(),

      // Product revenue (orders)
      Order.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo }, paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      ]),

      // Booking revenue
      Booking.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo }, paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
      ]),

      // Consultation revenue
      Consultation.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo }, paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$fee' }, count: { $sum: 1 } } },
      ]),
    ]);

    const stats = {
      // Ad monetization
      ads: {
        activeCampaigns,
        totalRevenue: totalAdRevenue[0]?.total || 0,
        impressions30d: totalImpressions[0]?.total || 0,
        clicks30d: totalClicks[0]?.total || 0,
        ctr: (totalImpressions[0]?.total || 0) > 0
          ? (((totalClicks[0]?.total || 0) / (totalImpressions[0]?.total || 1)) * 100).toFixed(2)
          : '0',
      },

      // Promo codes
      promos: {
        activeCodes: activePromos,
        totalDiscountGiven30d: totalDiscountGiven[0]?.total || 0,
        totalRevenueGenerated30d: totalPromoRevenue[0]?.total || 0,
        netRevenue: (totalPromoRevenue[0]?.total || 0) - (totalDiscountGiven[0]?.total || 0),
      },

      // Platform fees
      fees: {
        totalGross30d: feeStats[0]?.totalGross || 0,
        totalFees30d: feeStats[0]?.totalFees || 0,
        transactionCount30d: feeStats[0]?.count || 0,
        feePercentage: DEFAULT_FEE_PERCENTAGE,
        recentTransactions: recentFees,
      },

      // Revenue breakdown
      revenue: {
        products30d: {
          total: productRevenue[0]?.total || 0,
          count: productRevenue[0]?.count || 0,
        },
        bookings30d: {
          total: bookingRevenue[0]?.total || 0,
          count: bookingRevenue[0]?.count || 0,
        },
        consultations30d: {
          total: consultationRevenue[0]?.total || 0,
          count: consultationRevenue[0]?.count || 0,
        },
      },

      // Summary
      totalMonetizationRevenue30d: (
        (totalAdRevenue[0]?.total || 0)
        + (feeStats[0]?.totalFees || 0)
        + (productRevenue[0]?.total || 0)
        + (bookingRevenue[0]?.total || 0)
        + (consultationRevenue[0]?.total || 0)
      ),
    };

    res.json(stats);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
