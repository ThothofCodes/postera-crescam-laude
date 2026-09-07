const mongoose = require('mongoose');
const { emitSessionUpdate: _emitSessionUpdate } = require('../socket');
// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
const JobCard = require('../models/JobCard');
const PSSession = require('../models/PSSession');
const WebProject = require('../models/WebProject');
const GovDocument = require('../models/GovDocument');
const ISPClient = require('../models/ISPClient');
const { sendSMS, notifyCustomer } = require('../config/africastalking');

// Stage transitions worth notifying the customer about (Phase 9 market
// research, Tier 1 #1). 'completed' already sent an SMS before this change —
// this extends the same idea to the other stages a customer cares about.
// Keys match JobCard's real status enum exactly: ['received', 'diagnosing',
// 'awaiting-parts', 'in-repair', 'completed', 'collected', 'cancelled'].
const JOBCARD_STAGE_MESSAGES = {
  diagnosing: (job) => `Your device (${job.jobNumber}) is now being diagnosed at Postera Crescam Laude.`,
  'awaiting-parts': (job) => `Update on your device (${job.jobNumber}): we're waiting on a part. We'll notify you once it arrives.`,
  'in-repair': (job) => `Your device (${job.jobNumber}) is now being repaired at Postera Crescam Laude.`,
  completed: (job) => `Your device repair (${job.jobNumber}) is complete. Please collect at Postera Crescam Laude.`,
};

// ── JOB CARDS (Hardware Repair) ────────────────────────────────────────────
exports.getJobCards = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = { ...req.deptFilter };
    if (status) filter.status = status;
    const [jobs, total] = await Promise.all([
      JobCard.find(filter).populate('assignedTechnician', 'name').sort('-createdAt').skip((page - 1) * limit)
        .limit(Number(limit)),
      mongoose.connection.readyState === 1 ? JobCard.countDocuments(filter) : Promise.resolve(0),
    ]);
    res.json({ jobs, total, page: Number(page) });
  } catch (err) { next(err); }
};

exports.createJobCard = async (req, res, next) => {
  try {
    const job = await JobCard.create({ ...req.body, department: req.deptFilter.department });
    res.status(201).json(job);
  } catch (err) { next(err); }
};

exports.updateJobCard = async (req, res, next) => {
  try {
    const previousStatus = (await JobCard.findById(req.params.id).select('status'))?.status;
    const job = await JobCard.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!job) return res.status(404).json({ message: 'Job card not found' });
    if (req.body.status === 'completed') {
      job.completedAt = new Date();
      if (req.body.warrantyDays) {
        job.warrantyExpiry = new Date(Date.now() + req.body.warrantyDays * 86400000);
      }
      await job.save();
    }
    // FIX (Phase 9 market research, Tier 1 #1): previously only the
    // 'completed' stage ever notified the customer. Every meaningful stage
    // transition now does, using whichever channel the job card's
    // notifyChannel field requests (defaults to SMS, which always works).
    if (req.body.status && req.body.status !== previousStatus && JOBCARD_STAGE_MESSAGES[req.body.status]) {
      const notifyTo = job.clientEmail || job.clientPhone;
      if (notifyTo) notifyCustomer(notifyTo, JOBCARD_STAGE_MESSAGES[req.body.status](job), job.notifyChannel || 'sms');
    }
    try {
      const { emitDeptNotification, getIO } = require('../socket');
      // Staff-facing: existing department notification channel (real signature
      // is (deptSlug, payload) -> emits 'notification:new' to room dept:{slug}).
      const Department = require('../models/Department');
      const dept = await Department.findById(job.department).select('slug');
      if (dept?.slug) {
        emitDeptNotification(dept.slug, { type: 'JOBCARD_UPDATE', jobNumber: job.jobNumber, status: job.status });
      }
      // Customer-facing: anyone with the public tracker page open for this
      // specific job number gets a live push instead of having to refresh.
      getIO().to(`track:${job.jobNumber}`).emit('jobcard:status', { jobNumber: job.jobNumber, status: job.status });
    } catch (_) {}
    res.json(job);
  } catch (err) { next(err); }
};

/**
 * Public, unauthenticated repair status lookup (Phase 9 market research,
 * Tier 1 #1) — a PCL Centre customer looks up their device by job
 * number alone, no account or login needed. Deliberately returns only the
 * fields a customer should see — never clientPhone, internal notes, or cost
 * breakdowns, since this route has no auth in front of it.
 */
exports.trackJobCard = async (req, res, next) => {
  try {
    const jobNumber = (req.params.jobNumber || '').trim().toUpperCase().slice(0, 30);
    if (!jobNumber) return res.status(400).json({ message: 'Job number required' });
    const job = await JobCard.findOne({ jobNumber }).select(
      'jobNumber deviceType deviceBrand status estimatedCost finalCost paymentStatus warrantyExpiry createdAt completedAt collectedAt',
    );
    if (!job) return res.status(404).json({ message: 'No repair found with that job number' });
    res.json({ job });
  } catch (err) { next(err); }
};

// ── PS SESSIONS (PlayStation Arena) ───────────────────────────────────────
exports.getSessions = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 30 } = req.query;
    const filter = { ...req.deptFilter };
    if (status) filter.status = status;
    const [sessions, total] = await Promise.all([
      PSSession.find(filter).sort('-startTime').skip((page - 1) * limit).limit(Number(limit)),
      mongoose.connection.readyState === 1 ? PSSession.countDocuments(filter) : Promise.resolve(0),
    ]);
    res.json({ sessions, total });
  } catch (err) { next(err); }
};

exports.startSession = async (req, res, next) => {
  try {
    const session = await PSSession.create({
      ...req.body,
      department: req.deptFilter.department,
      startTime: new Date(),
      status: 'active',
      createdBy: req.user._id,
    });
    // Real-time: broadcast session start to dept
    try { const { emitSessionUpdate } = require('../socket'); emitSessionUpdate('playstation', session); } catch (_) {}
    res.status(201).json(session);
  } catch (err) { next(err); }
};

exports.endSession = async (req, res, next) => {
  try {
    const session = await PSSession.findById(req.params.id);
    if (!session) return res.status(404).json({ message: 'Session not found' });
    session.endTime = new Date();
    session.durationMinutes = Math.ceil((session.endTime - session.startTime) / 60000);
    session.totalCharged = Math.ceil((session.durationMinutes / 60) * session.hourlyRate);
    session.status = 'completed';
    await session.save();
    // Real-time: broadcast session end to dept
    try { const { emitSessionUpdate } = require('../socket'); emitSessionUpdate('playstation', session); } catch (_) {}
    res.json(session);
  } catch (err) { next(err); }
};

// ── WEB PROJECTS (Web Development) ────────────────────────────────────────
exports.getProjects = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = { ...req.deptFilter };
    if (status) filter.status = status;
    const [projects, total] = await Promise.all([
      WebProject.find(filter).populate('assignedTo', 'name').sort('-createdAt').skip((page - 1) * limit)
        .limit(Number(limit)),
      mongoose.connection.readyState === 1 ? WebProject.countDocuments(filter) : Promise.resolve(0),
    ]);
    res.json({ projects, total });
  } catch (err) { next(err); }
};

exports.createProject = async (req, res, next) => {
  try {
    const project = await WebProject.create({ ...req.body, department: req.deptFilter.department });
    res.status(201).json(project);
  } catch (err) { next(err); }
};

exports.updateProject = async (req, res, next) => {
  try {
    const project = await WebProject.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!project) return res.status(404).json({ message: 'Project not found' });
    res.json(project);
  } catch (err) { next(err); }
};

// ── GOV DOCUMENTS (Gov Admin Assistance) ──────────────────────────────────
exports.getGovDocs = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = { ...req.deptFilter };
    if (status) filter.status = status;
    const [docs, total] = await Promise.all([
      GovDocument.find(filter).sort('-createdAt').skip((page - 1) * limit).limit(Number(limit)),
      mongoose.connection.readyState === 1 ? GovDocument.countDocuments(filter) : Promise.resolve(0),
    ]);
    res.json({ docs, total });
  } catch (err) { next(err); }
};

exports.createGovDoc = async (req, res, next) => {
  try {
    const doc = await GovDocument.create({ ...req.body, department: req.deptFilter.department });
    res.status(201).json(doc);
  } catch (err) { next(err); }
};

exports.updateGovDoc = async (req, res, next) => {
  try {
    const doc = await GovDocument.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    if (req.body.status === 'completed') {
      const notifyTo = doc.clientEmail || doc.clientPhone;
      if (notifyTo) sendSMS(notifyTo, `Your document request (${doc.ticketNumber}) is ready for collection at Postera Crescam Laude.`);
    }
    res.json(doc);
  } catch (err) { next(err); }
};

// ── ISP CLIENTS (Internet Distribution) ───────────────────────────────────
exports.getISPClients = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = { ...req.deptFilter };
    if (status) filter.status = status;
    const [clients, total] = await Promise.all([
      ISPClient.find(filter).sort('name').skip((page - 1) * limit).limit(Number(limit)),
      mongoose.connection.readyState === 1 ? ISPClient.countDocuments(filter) : Promise.resolve(0),
    ]);
    res.json({ clients, total });
  } catch (err) { next(err); }
};

exports.createISPClient = async (req, res, next) => {
  try {
    const client = await ISPClient.create({ ...req.body, department: req.deptFilter.department });
    res.status(201).json(client);
  } catch (err) { next(err); }
};

exports.updateISPClient = async (req, res, next) => {
  try {
    const client = await ISPClient.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!client) return res.status(404).json({ message: 'Client not found' });
    res.json(client);
  } catch (err) { next(err); }
};
