const mongoose = require('mongoose');
// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
const Booking = require('../models/Booking');
const Client = require('../models/Client');
const Service = require('../models/Service');
const Revenue = require('../models/Revenue');
const { sendSMS } = require('../config/africastalking');

// Build query filter — STAFF only see bookings for services in their dept
const buildFilter = async (req, extra = {}) => {
  const filter = { ...extra };
  const role = req.user?.role;

  if (['STAFF', 'staff'].includes(role) && req.user.departmentSlug) {
    // Find service IDs that belong to this dept's category
    const deptCategoryMap = {
      internet: 'internet',
      webdev: 'web-dev',
      playstation: 'gaming',
      repair: 'hardware',
      cybersecurity: 'cybersecurity',
      govadmin: 'other',
    };
    const category = deptCategoryMap[req.user.departmentSlug];
    if (category) {
      const services = await Service.find({ category }).select('_id');
      filter.service = { $in: services.map((s) => s._id) };
    }
  }
  return filter;
};

exports.getBookings = async (req, res, next) => {
  try {
    const {
      status, paymentStatus, page = 1, limit = 20,
    } = req.query;
    const extra = {};
    if (status) extra.status = status;
    if (paymentStatus) extra.paymentStatus = paymentStatus;
    const filter = await buildFilter(req, extra);

    const [bookings, total] = await Promise.all([
      Booking.find(filter).populate('client', 'name phone').populate('service', 'name category')
        .sort('-createdAt')
        .skip((page - 1) * limit)
        .limit(Number(limit)),
      mongoose.connection.readyState === 1 ? Booking.countDocuments(filter) : Promise.resolve(0),
    ]);
    res.json({
      bookings, total, page: Number(page), pages: Math.ceil(total / limit),
    });
  } catch (err) { next(err); }
};

exports.getBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('client').populate('service');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json(booking);
  } catch (err) { next(err); }
};

exports.createBooking = async (req, res, next) => {
  try {
    const booking = await Booking.create(req.body);
    await Client.findByIdAndUpdate(req.body.client, { $inc: { bookingCount: 1 } });
    res.status(201).json(booking);
  } catch (err) { next(err); }
};

exports.updateBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate('client', 'name phone').populate('service', 'name');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json(booking);
  } catch (err) { next(err); }
};

exports.recordPayment = async (req, res, next) => {
  try {
    const { paymentMethod, mpesaRef, amount } = req.body;
    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) return res.status(400).json({ message: 'Valid amount required' });

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { paymentStatus: 'paid', paymentMethod, mpesaRef },
      { new: true },
    ).populate('client', 'name phone').populate('service', 'name');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (!booking.client || !booking.service) return res.status(400).json({ message: 'Booking has missing client or service reference' });

    await Revenue.create({
      type: 'income',
      category: 'booking',
      description: `${booking.service.name} — ${booking.client.name}`,
      amount: parsedAmount,
      paymentMethod,
      reference: mpesaRef,
      createdBy: req.user._id,
    });
    await Service.findByIdAndUpdate(booking.service._id, { $inc: { totalRevenue: parsedAmount } });
    await Client.findByIdAndUpdate(booking.client._id, { $inc: { totalSpent: parsedAmount } });

    const notifyTo = booking.client.email || booking.client.phone;
    if (notifyTo) sendSMS(notifyTo, `Payment confirmed for ${booking.service.name}. Ref: ${mpesaRef || 'N/A'}. Thank you!`);
    res.json(booking);
  } catch (err) { next(err); }
};

exports.deleteBooking = async (req, res, next) => {
  try {
    await Booking.findByIdAndDelete(req.params.id);
    res.json({ message: 'Booking deleted' });
  } catch (err) { next(err); }
};
