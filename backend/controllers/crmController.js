// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
const mongoose = require('mongoose');
const CRMClient = require('../models/CRMClient');
const { sendSMS } = require('../config/africastalking');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const safePage = (p) => Math.max(1, Math.min(Number(p) || 1, 1000));
const safeLimit = (l) => Math.max(1, Math.min(Number(l) || 20, 100));

const genReferralCode = () => Math.random().toString(36).substring(2, 10).toUpperCase();
const genOTP = () => String(Math.floor(100000 + Math.random() * 900000));

exports.getClients = async (req, res, next) => {
  try {
    const page = safePage(req.query.page); const
      limit = safeLimit(req.query.limit);
    const filter = req.user.role === 'SUPER_ADMIN' ? {} : { departmentSlug: req.user.departmentSlug };
    if (req.query.segment) filter.segment = req.query.segment;
    if (req.query.search) {
      const s = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 100);
      filter.$or = [{ fullName: new RegExp(s, 'i') }, { phone: new RegExp(s, 'i') }, { email: new RegExp(s, 'i') }];
    }
    const [clients, total] = await Promise.all([
      CRMClient.find(filter).sort('-createdAt').skip((page - 1) * limit).limit(limit)
        .select('-portalOTP -portalOTPExpiry'),
      CRMClient.countDocuments(filter),
    ]);
    res.json({
      clients, total, page, pages: Math.ceil(total / limit),
    });
  } catch (err) { next(err); }
};

exports.getClient = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid ID' });
    const client = await CRMClient.findById(req.params.id).select('-portalOTP -portalOTPExpiry');
    if (!client) return res.status(404).json({ message: 'Client not found' });
    res.json(client);
  } catch (err) { next(err); }
};

exports.createClient = async (req, res, next) => {
  try {
    const {
      fullName, phone, email, idType, idNumber, address, tags, notes, segment,
    } = req.body;
    if (!fullName || !phone) return res.status(400).json({ message: 'Full name and phone required' });
    const deptId = req.user.department?._id || req.user.department;
    const deptSlug = req.user.departmentSlug;
    const client = await CRMClient.create({
      department: deptId,
      departmentSlug: deptSlug,
      fullName: fullName.trim().slice(0, 150),
      phone: phone.replace(/\D/g, '').slice(0, 15),
      email: email?.toLowerCase().trim(),
      idType,
      idNumber,
      address,
      tags: Array.isArray(tags) ? tags : [],
      notes,
      segment: segment || 'LEAD',
      referralCode: genReferralCode(),
    });
    res.status(201).json(client);
  } catch (err) { next(err); }
};

exports.updateClient = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid ID' });
    const allowed = ['fullName', 'phone', 'altPhone', 'email', 'idType', 'idNumber', 'kycStatus', 'address', 'tags', 'segment', 'notes'];
    const update = {};
    allowed.forEach((k) => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
    const client = await CRMClient.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!client) return res.status(404).json({ message: 'Client not found' });
    res.json(client);
  } catch (err) { next(err); }
};

exports.addInteraction = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid ID' });
    const {
      type, summary, outcome, followUpDate,
    } = req.body;
    if (!summary) return res.status(400).json({ message: 'Summary required' });
    const client = await CRMClient.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          interactions: {
            staffId: req.user._id, type, summary: summary.slice(0, 1000), outcome, followUpDate,
          },
        },
        $set: { lastInteraction: new Date() },
      },
      { new: true },
    );
    if (!client) return res.status(404).json({ message: 'Client not found' });
    res.json({ message: 'Interaction logged', lastInteraction: client.lastInteraction });
  } catch (err) { next(err); }
};

exports.sendPortalInvite = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid ID' });
    const client = await CRMClient.findById(req.params.id);
    if (!client) return res.status(404).json({ message: 'Client not found' });
    const otp = genOTP();
    const expiry = new Date(Date.now() + 10 * 60000);
    await CRMClient.findByIdAndUpdate(req.params.id, { portalOTP: otp, portalOTPExpiry: expiry, portalAccess: true });
    const notifyTo = client.email || client.phone;
    if (notifyTo) sendSMS(notifyTo, `Your Postera Crescam Laude portal access code is: ${otp}. Valid for 10 minutes. Visit: pclsolutions.co.ke/client`);
    res.json({ message: 'Portal invite sent' });
  } catch (err) { next(err); }
};

exports.bulkSMS = async (req, res, next) => {
  try {
    const { segment, message } = req.body;
    if (!message || message.length > 160) return res.status(400).json({ message: 'Message required (max 160 chars)' });
    const filter = { departmentSlug: req.user.departmentSlug };
    if (segment) filter.segment = segment;
    const clients = await CRMClient.find(filter).select('phone email');
    const contacts = clients.map((c) => c.email || c.phone).filter(Boolean);
    if (!contacts.length) return res.status(400).json({ message: 'No clients found for this segment' });
    sendSMS(contacts, message);
    res.json({ message: `Notifications queued for ${contacts.length} clients` });
  } catch (err) { next(err); }
};

exports.verifyPortalOTP = async (req, res, next) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) return res.status(400).json({ message: 'Phone and OTP required' });
    const client = await CRMClient.findOne({ phone: phone.replace(/\D/g, '') });
    if (!client) return res.status(404).json({ message: 'Client not found' });
    if (client.portalOTP !== otp || new Date() > client.portalOTPExpiry) {
      return res.status(401).json({ message: 'Invalid or expired OTP' });
    }
    await CRMClient.findByIdAndUpdate(client._id, { $unset: { portalOTP: 1, portalOTPExpiry: 1 } });
    const jwt = require('jsonwebtoken');
    // CRM client tokens use a separate secret to prevent cross-role token reuse
    const CRM_SECRET = process.env.CRM_JWT_SECRET || process.env.JWT_SECRET;
    const token = jwt.sign(
      {
        id: client._id, role: 'CLIENT', clientId: client._id, departmentSlug: client.departmentSlug,
      },
      CRM_SECRET,
      { expiresIn: '8h', algorithm: 'HS256' },
    );
    res.json({
      token,
      client: {
        id: client._id, fullName: client.fullName, phone: client.phone, departmentSlug: client.departmentSlug,
      },
    });
  } catch (err) { next(err); }
};

exports.requestOTP = async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: 'Phone required' });
    const client = await CRMClient.findOne({ phone: phone.replace(/\D/g, '') });
    if (!client || !client.portalAccess) return res.status(404).json({ message: 'No portal account found for this number' });
    const otp = genOTP();
    const expiry = new Date(Date.now() + 10 * 60000);
    await CRMClient.findByIdAndUpdate(client._id, { portalOTP: otp, portalOTPExpiry: expiry });
    const notifyTo = client.email || client.phone;
    if (notifyTo) sendSMS(notifyTo, `Your Postera Crescam Laude login code: ${otp}. Valid 10 minutes.`);
    res.json({ message: 'OTP sent' });
  } catch (err) { next(err); }
};

// ── Loyalty Points — Redeem ───────────────────────────────────────────────────
exports.redeemPoints = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { pointsToRedeem, invoiceId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid client ID' });
    const pts = Number(pointsToRedeem);
    if (!pts || pts < 100 || pts % 100 !== 0) return res.status(400).json({ message: 'Points must be a multiple of 100 (minimum 100)' });
    const client = await CRMClient.findById(id);
    if (!client) return res.status(404).json({ message: 'Client not found' });
    if (client.loyaltyPoints < pts) return res.status(400).json({ message: `Insufficient points (balance: ${client.loyaltyPoints})` });
    const discount = (pts / 100) * 50; // 100 pts = KES 50
    client.loyaltyPoints -= pts;
    await client.save();
    // Apply credit to invoice if provided
    if (invoiceId && mongoose.Types.ObjectId.isValid(invoiceId)) {
      const Invoice = require('../models/Invoice');
      const inv = await Invoice.findById(invoiceId);
      if (inv && inv.status !== 'PAID') {
        inv.lineItems.push({
          description: `Loyalty Points Discount (${pts} pts)`, qty: 1, unitPrice: -discount, total: -discount,
        });
        inv.totalAmount = Math.max(0, inv.totalAmount - discount);
        inv.balance = Math.max(0, inv.balance - discount);
        await inv.save();
      }
    }
    res.json({ message: `${pts} points redeemed for KES ${discount} discount`, balance: client.loyaltyPoints, discount });
  } catch (err) { next(err); }
};

// ── Referral — generate code ──────────────────────────────────────────────────
exports.generateReferralCode = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid ID' });
    const client = await CRMClient.findById(id);
    if (!client) return res.status(404).json({ message: 'Client not found' });
    if (client.referralCode) return res.json({ referralCode: client.referralCode });
    const code = require('crypto').randomBytes(4).toString('hex').toUpperCase();
    client.referralCode = code;
    await client.save();
    res.json({ referralCode: code });
  } catch (err) { next(err); }
};
