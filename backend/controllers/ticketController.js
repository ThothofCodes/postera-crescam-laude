const mongoose = require('mongoose');
// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
const Ticket = require('../models/Ticket');
const { notifyCustomer } = require('../config/africastalking');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const safePage = (p) => Math.max(1, Math.min(Number(p) || 1, 1000));
const safeLimit = (l) => Math.max(1, Math.min(Number(l) || 20, 100));

exports.createTicket = async (req, res, next) => {
  try {
    const {
      title, description, category, priority, departmentSlug,
    } = req.body;
    if (!title || !description) return res.status(400).json({ message: 'Title and description required' });
    const isClient = req.user.role === 'CLIENT';
    const ticket = await Ticket.create({
      department: req.user.department?._id || req.user.department || null,
      departmentSlug: departmentSlug || req.user.departmentSlug || 'general',
      raisedBy: req.user._id,
      raisedByRole: isClient ? 'CLIENT' : 'STAFF',
      title: title.trim().slice(0, 200),
      description: description.trim().slice(0, 5000),
      category: category || 'General',
      priority: priority || 'MEDIUM',
    });
    res.status(201).json(ticket);
  } catch (err) { next(err); }
};

exports.getTickets = async (req, res, next) => {
  try {
    const page = safePage(req.query.page); const
      limit = safeLimit(req.query.limit);
    const filter = req.user.role === 'SUPER_ADMIN' ? {} : { departmentSlug: req.user.departmentSlug };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.priority) filter.priority = req.query.priority;
    if (req.query.slaBreach === 'true') filter.slaBreach = true;
    const [tickets, total] = await Promise.all([
      Ticket.find(filter).populate('assignedTo', 'name').sort('-createdAt').skip((page - 1) * limit)
        .limit(limit),
      Ticket.countDocuments(filter),
    ]);
    res.json({ tickets, total, page });
  } catch (err) { next(err); }
};

exports.getMyTickets = async (req, res, next) => {
  try {
    const tickets = await Ticket.find({ raisedBy: req.user._id }).sort('-createdAt').limit(50);
    res.json(tickets);
  } catch (err) { next(err); }
};

exports.getTicket = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid ID' });
    const ticket = await Ticket.findById(req.params.id).populate('assignedTo', 'name email');
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    res.json(ticket);
  } catch (err) { next(err); }
};

exports.assignTicket = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid ID' });
    const { staffId } = req.body;
    if (!isValidId(staffId)) return res.status(400).json({ message: 'Invalid staff ID' });
    const ticket = await Ticket.findByIdAndUpdate(req.params.id, { assignedTo: staffId, status: 'IN_PROGRESS' }, { new: true });
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    res.json(ticket);
  } catch (err) { next(err); }
};

exports.replyTicket = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid ID' });
    const { message } = req.body;
    if (!message) return res.status(400).json({ message: 'Message required' });
    const ticket = await Ticket.findByIdAndUpdate(
      req.params.id,
      { $push: { thread: { author: req.user._id, authorRole: req.user.role, message: message.slice(0, 5000) } } },
      { new: true },
    );
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    // Real-time: push reply to ticket watchers
    try {
      const { emitTicketReply } = require('../socket');
      const entry = ticket?.thread?.[ticket.thread.length - 1];
      if (entry) emitTicketReply(String(ticket._id), entry);
    } catch (_) {}
    res.json(ticket);
  } catch (err) { next(err); }
};

exports.updateStatus = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid ID' });
    const VALID = ['OPEN', 'IN_PROGRESS', 'AWAITING_CLIENT', 'RESOLVED', 'CLOSED', 'REOPENED'];
    if (!VALID.includes(req.body.status)) return res.status(400).json({ message: 'Invalid status' });

    const previousTicket = await Ticket.findById(req.params.id).select('status assignedTo');
    const update = { status: req.body.status };
    if (req.body.status === 'RESOLVED') update.resolvedAt = new Date();
    if (req.body.status === 'CLOSED') update.closedAt = new Date();
    // Auto-assign to claiming admin when moving to IN_PROGRESS
    if (req.body.status === 'IN_PROGRESS' && !previousTicket?.assignedTo) {
      update.assignedTo = req.user.id;
    }

    const ticket = await Ticket.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    // Phase 9 market research, Tier 1 #1: auto-SMS on status changes.
    // Ticket model does not currently store client phone directly, so we
    // attempt to resolve it from the raisedBy user.
    if (previousTicket?.status !== req.body.status) {
      try {
        const User = require('../models/User');
        const client = await User.findById(ticket.raisedBy).select('phone email');
        const phone = client?.email || client?.phone;
        if (phone) {
          const messages = {
            OPEN: 'Your support ticket is received. We will update you shortly.',
            IN_PROGRESS: 'Your support ticket is now being handled. We will update you when there is progress.',
            AWAITING_CLIENT: 'We are waiting for your response to continue handling your ticket. Please check in with Postera Crescam Laude.',
            RESOLVED: 'Your support ticket has been resolved. Thank you for your patience.',
            CLOSED: 'Your support ticket is now closed. If you need further help, please contact us again.',
            REOPENED: 'Your support ticket has been reopened. We will continue working on it.',
          };

          const msg = messages[ticket.status] || `Update on your ticket: ${ticket.status}`;
          await notifyCustomer(phone, msg, ticket.notifyChannel || 'sms');
        }
      } catch (_) {
        // best-effort notification only
      }
    }

    res.json(ticket);
  } catch (err) { next(err); }
};

// Public, unauthenticated ticket tracker (Tier 1 #1)
exports.trackTicket = async (req, res, next) => {
  try {
    const referenceNumber = String(req.body?.referenceNumber || '').trim().toUpperCase();
    if (!referenceNumber) return res.status(400).json({ message: 'referenceNumber is required' });

    const ticket = await Ticket.findOne({ ticketId: referenceNumber }).select(
      'ticketId title status departmentSlug createdAt updatedAt resolvedAt closedAt satisfactionScore priority',
    );

    if (!ticket) return res.status(404).json({ message: 'No ticket found with that reference number' });

    res.json({
      ticket: {
        ticketId: ticket.ticketId,
        title: ticket.title,
        status: ticket.status,
        departmentSlug: ticket.departmentSlug,
        priority: ticket.priority,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        resolvedAt: ticket.resolvedAt,
        closedAt: ticket.closedAt,
        satisfactionScore: ticket.satisfactionScore,
      },
    });
  } catch (err) { next(err); }
};

exports.escalateTicket = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid ID' });
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'codeofthoth@outlook.com';
    const User = require('../models/User');
    const superAdmin = await User.findOne({ email: superAdminEmail });
    const ticket = await Ticket.findByIdAndUpdate(
      req.params.id,
      { status: 'ESCALATED', escalatedTo: superAdmin?._id },
      { new: true },
    );
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    res.json(ticket);
  } catch (err) { next(err); }
};

exports.rateTicket = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid ID' });
    const score = Number(req.body.score);
    if (!score || score < 1 || score > 5) return res.status(400).json({ message: 'Score must be 1–5' });
    const ticket = await Ticket.findByIdAndUpdate(req.params.id, { satisfactionScore: score }, { new: true });
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    res.json(ticket);
  } catch (err) { next(err); }
};

exports.getEscalated = async (req, res, next) => {
  try {
    const tickets = await Ticket.find({ status: 'ESCALATED' }).populate('department', 'name slug').sort('-createdAt');
    res.json(tickets);
  } catch (err) { next(err); }
};

// Public ticket creation — no auth required, customers submit directly
exports.createPublicTicket = async (req, res, next) => {
  try {
    const {
      title, description, category, priority, departmentSlug, name, email, phone,
    } = req.body;
    if (!title || !description) return res.status(400).json({ message: 'Title and description required' });

    const ticket = await Ticket.create({
      department: null,
      departmentSlug: departmentSlug || 'general',
      raisedBy: null, // No user account required
      raisedByRole: 'CLIENT',
      title: title.trim().slice(0, 200),
      description: description.trim().slice(0, 5000),
      category: category || 'General',
      priority: priority || 'MEDIUM',
      // Store contact info in thread for admin reference
      thread: (name || email || phone) ? [{
        author: null,
        authorRole: 'CLIENT',
        message: `Contact: ${name || 'Anonymous'} | ${email || 'no email'} | ${phone || 'no phone'}`,
      }] : [],
    });

    res.status(201).json({
      success: true,
      ticketId: ticket.ticketId,
      message: `Ticket ${ticket.ticketId} created. Save this reference to track your request.`,
    });
  } catch (err) { next(err); }
};
