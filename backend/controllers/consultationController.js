const mongoose = require('mongoose');
// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
const Consultation = require('../models/Consultation');
const Client = require('../models/Client');
const AvailabilitySlot = require('../models/AvailabilitySlot');
const Revenue = require('../models/Revenue');
const { stkPush } = require('../middleware/mpesa');
const { sendSMS } = require('../config/africastalking');
const { sendEmail } = require('../config/mailer');

const CONSULTATION_FEES = {
  'web-development': { 60: 1500, 90: 2000 },
  cybersecurity: { 60: 2000, 90: 3000 },
  'business-digitisation': { 60: 1500, 90: 2500 },
  networking: { 30: 800, 60: 1500 },
  'hardware-advisory': { 30: 500, 60: 1000 },
  'social-media-strategy': { 60: 1000, 90: 1800 },
  'data-recovery': { 30: 800, 60: 1500 },
  'general-it': { 30: 500, 60: 1000 },
};

exports.getTypes = (req, res) => {
  const types = Object.entries(CONSULTATION_FEES).map(([type, fees]) => ({ type, fees }));
  res.json(types);
};

exports.getAvailability = async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: 'date query param required' });
    const start = new Date(date);
    const end = new Date(date);
    end.setDate(end.getDate() + 7);
    const slots = await AvailabilitySlot.find({ date: { $gte: start, $lte: end }, isBooked: false, isBlocked: false })
      .populate('consultant', 'name')
      .sort('date startTime');
    res.json(slots);
  } catch (err) { next(err); }
};

exports.getConsultations = async (req, res, next) => {
  try {
    const {
      status, consultationType, page = 1, limit = 20,
    } = req.query;
    const query = {};
    if (status) query.status = status;
    if (consultationType) query.consultationType = consultationType;
    const [consultations, total] = await Promise.all([
      Consultation.find(query).populate('client', 'name phone email').sort('-createdAt')
        .skip((page - 1) * limit)
        .limit(Number(limit)),
      Consultation.countDocuments(query),
    ]);
    res.json({
      consultations, total, page: Number(page), pages: Math.ceil(total / limit),
    });
  } catch (err) { next(err); }
};

exports.getConsultation = async (req, res, next) => {
  try {
    const c = await Consultation.findById(req.params.id).populate('client');
    if (!c) return res.status(404).json({ message: 'Consultation not found' });
    res.json(c);
  } catch (err) { next(err); }
};

exports.createConsultation = async (req, res, next) => {
  try {
    const {
      consultationType, duration, payNow, ...rest
    } = req.body;
    // duration arrives as string from JSON; coerce to number for lookup
    const durationNum = Number(duration);
    const fee = CONSULTATION_FEES[consultationType]?.[durationNum];
    if (!fee) return res.status(400).json({ message: 'Invalid consultation type or duration combination' });

    const consultation = await Consultation.create({
      ...rest, consultationType, duration: durationNum, fee,
    });
    await Client.findByIdAndUpdate(rest.client, { $inc: { bookingCount: 1 } });

    // Fetch client once for STK push and SMS
    const client = await Client.findById(rest.client);
    if (!client) return res.status(404).json({ message: 'Client not found' });

    if (payNow) {
      try {
        const mpesaRes = await stkPush(client.phone, fee, `CONSULT-${consultation._id}`, 'PCL Consultation');
        consultation.checkoutRequestId = mpesaRes.CheckoutRequestID;
        await consultation.save();
      } catch (mpesaErr) {
        console.error('STK Push failed:', mpesaErr.message);
      }
    }

    const notifyTo = client.email || client.phone;
    if (notifyTo) sendSMS(notifyTo, `Consultation booked! Type: ${consultationType}, Date: ${new Date(rest.preferredDate).toDateString()}. Fee: KES ${fee}.`);
    res.status(201).json(consultation);
  } catch (err) { next(err); }
};

exports.confirmConsultation = async (req, res, next) => {
  try {
    const c = await Consultation.findByIdAndUpdate(req.params.id, { status: 'confirmed' }, { new: true }).populate('client');
    if (!c) return res.status(404).json({ message: 'Consultation not found' });
    const notifyTo = c.client?.email || c.client?.phone;
    if (notifyTo) {
      sendSMS(notifyTo, `Your consultation on ${new Date(c.preferredDate).toDateString()} is CONFIRMED. See you then!`);
    }
    res.json(c);
  } catch (err) { next(err); }
};

exports.completeConsultation = async (req, res, next) => {
  try {
    const { consultantNotes, clientSummary, followUpRequired } = req.body;
    const c = await Consultation.findByIdAndUpdate(
      req.params.id,
      {
        status: 'completed', consultantNotes, clientSummary, followUpRequired,
      },
      { new: true },
    ).populate('client');
    if (!c) return res.status(404).json({ message: 'Consultation not found' });

    await Revenue.create({
      type: 'income',
      category: 'consultation',
      description: `${c.consultationType} — ${c.client?.name || 'Unknown'}`,
      amount: c.fee,
      paymentMethod: 'mpesa',
      createdBy: req.user._id,
    });
    if (c.client?._id) {
      await Client.findByIdAndUpdate(c.client._id, { $inc: { totalSpent: c.fee } });
    }

    if (c.client?.email && clientSummary) {
      try {
        await sendEmail({
          to: c.client.email,
          subject: 'Your PCL Consultation Summary',
          html: `<h2>Consultation Summary</h2><p>${clientSummary}</p>`,
        });
      } catch (emailErr) {
        console.error('Summary email failed:', emailErr.message);
      }
    }
    res.json(c);
  } catch (err) { next(err); }
};

exports.cancelConsultation = async (req, res, next) => {
  try {
    const c = await Consultation.findByIdAndUpdate(req.params.id, { status: 'cancelled' }, { new: true }).populate('client');
    if (!c) return res.status(404).json({ message: 'Consultation not found' });
    if (mongoose.connection.readyState === 1) {
      await AvailabilitySlot.findOneAndUpdate({ consultation: c._id }, { isBooked: false, consultation: null });
    }
    const notifyTo = c.client?.email || c.client?.phone;
    if (notifyTo) {
      sendSMS(notifyTo, `Your consultation on ${new Date(c.preferredDate).toDateString()} has been cancelled. Contact us to reschedule.`);
    }
    res.json(c);
  } catch (err) { next(err); }
};

exports.getStats = async (req, res, next) => {
  try {
    const stats = await Consultation.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: { type: '$consultationType', month: { $month: '$createdAt' } }, count: { $sum: 1 }, revenue: { $sum: '$fee' } } },
      { $sort: { '_id.month': 1 } },
    ]);
    res.json(stats);
  } catch (err) { next(err); }
};
