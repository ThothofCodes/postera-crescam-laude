// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// Self-hosted error tracker — ingestion, querying, and resolution.

const crypto = require('crypto');
const ErrorLog = require('../models/ErrorLog');
const logger = require('../utils/logger');

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Generate a fingerprint for grouping similar errors */
function generateFingerprint(message, stack, path) {
  const data = `${message}|${stack || ''}|${path || ''}`;
  return crypto.createHash('sha256').update(data).digest('hex').slice(0, 16);
}

/** Sanitize stack trace — remove base URLs */
function cleanStack(stack) {
  if (!stack) return stack;
  return stack
    .replace(/https?:\/\/[^\s)]+/g, (url) => {
      try {
        const u = new URL(url);
        return u.pathname + u.search;
      } catch {
        return url;
      }
    })
    .trim();
}

// ── POST /api/v1/errors — Ingest errors from frontend ──────────────────────

exports.ingestErrors = async (req, res) => {
  try {
    const { errors } = req.body;
    if (!Array.isArray(errors) || errors.length === 0) {
      return res.status(400).json({ message: 'errors array is required' });
    }

    const batch = errors.slice(0, 20); // Cap at 20 per request
    const results = [];

    for (const err of batch) {
      const fingerprint = generateFingerprint(
        err.message,
        err.stack,
        err.pagePath || err.path,
      );

      // Try to update an existing error (increment count)
      const existing = await ErrorLog.findOneAndUpdate(
        { fingerprint, status: { $ne: 'resolved' } },
        {
          $inc: { count: 1 },
          $set: { lastOccurrence: new Date() },
        },
        { new: true },
      );

      if (existing) {
        results.push({ id: existing._id, fingerprint, merged: true });
      } else {
        // Create new error entry
        const errorDoc = await ErrorLog.create({
          source: err.source || 'frontend',
          level: err.level || 'error',
          message: err.message || 'Unknown error',
          name: err.name,
          stack: cleanStack(err.stack),
          fingerprint,
          count: 1,
          firstOccurrence: new Date(),
          lastOccurrence: new Date(),
          environment: process.env.NODE_ENV || 'production',
          appVersion: err.appVersion,
          // Frontend context
          url: err.url,
          pagePath: err.pagePath,
          componentStack: err.componentStack,
          lineNumber: err.lineNumber,
          columnNumber: err.columnNumber,
          fileName: err.fileName,
          userAgent: err.userAgent || req.headers['user-agent'],
          // User context (if authenticated)
          userId: req.user?._id,
          userEmail: req.user?.email,
          userRole: req.user?.role,
          ip: req.ip,
        });
        results.push({ id: errorDoc._id, fingerprint, merged: false });
      }
    }

    res.json({ received: batch.length, results });
  } catch (err) {
    // Never fail the client on error reporting
    logger.error('Error ingestion failed', { error: err.message });
    res.json({ received: 0, error: 'Ingestion failed' });
  }
};

// ── GET /api/v1/errors — List errors with filtering ─────────────────────────

exports.getErrors = async (req, res, next) => {
  try {
    const {
      source, status, level, name, fingerprint,
      page = 1, limit = 50, sort = '-createdAt',
    } = req.query;

    const filter = {};
    if (source) filter.source = source;
    if (status) filter.status = status;
    else filter.status = { $ne: 'ignored' }; // Hide ignored by default
    if (level) filter.level = level;
    if (name) filter.name = name;
    if (fingerprint) filter.fingerprint = fingerprint;

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(parseInt(limit, 10) || 50, 200);
    const take = Math.min(parseInt(limit, 10) || 50, 200);

    const [errors, total] = await Promise.all([
      ErrorLog.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(take)
        .select('-__v')
        .lean(),
      ErrorLog.countDocuments(filter),
    ]);

    res.json({
      errors,
      pagination: {
        page: parseInt(page, 10) || 1,
        limit: take,
        total,
        pages: Math.ceil(total / take),
      },
    });
  } catch (err) { next(err); }
};

// ── GET /api/v1/errors/stats — Aggregated error statistics ──────────────────

exports.getErrorStats = async (req, res, next) => {
  try {
    const { days = 7 } = req.query;
    const since = new Date(Date.now() - parseInt(days, 10) * 24 * 60 * 60 * 1000);

    const [bySource, byStatus, topErrors, recentCount, openCount] = await Promise.all([
      // By source
      ErrorLog.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$source', count: { $sum: '$count' }, unique: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      // By status
      ErrorLog.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      // Top errors by count
      ErrorLog.find({ createdAt: { $gte: since }, status: { $ne: 'ignored' } })
        .sort({ count: -1 })
        .limit(10)
        .select('message name source count status lastOccurrence fingerprint')
        .lean(),
      // Recent count (last 24h)
      ErrorLog.countDocuments({ createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
      // Open count
      ErrorLog.countDocuments({ status: 'open' }),
    ]);

    res.json({
      period: `${days} days`,
      bySource,
      byStatus,
      topErrors,
      recentCount,
      openCount,
    });
  } catch (err) { next(err); }
};

// ── PATCH /api/v1/errors/:id/status — Update error status ───────────────────

exports.updateErrorStatus = async (req, res, next) => {
  try {
    const { status, notes } = req.body;
    if (!['open', 'investigating', 'resolved', 'ignored'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const update = { status };
    if (status === 'resolved') {
      update.resolvedBy = req.user._id;
      update.resolvedAt = new Date();
    }
    if (notes) update.notes = notes;

    const error = await ErrorLog.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true },
    );
    if (!error) return res.status(404).json({ message: 'Error not found' });

    res.json({ error });
  } catch (err) { next(err); }
};

// ── DELETE /api/v1/errors/:id — Delete a single error ───────────────────────

exports.deleteError = async (req, res, next) => {
  try {
    const error = await ErrorLog.findByIdAndDelete(req.params.id);
    if (!error) return res.status(404).json({ message: 'Error not found' });
    res.json({ message: 'Error deleted' });
  } catch (err) { next(err); }
};

// ── POST /api/v1/errors/clear — Bulk clear resolved/old errors ──────────────

exports.clearErrors = async (req, res, next) => {
  try {
    const { status = 'resolved', olderThanDays } = req.body;
    const filter = { status };
    if (olderThanDays) {
      filter.createdAt = { $lt: new Date(Date.now() - parseInt(olderThanDays, 10) * 24 * 60 * 60 * 1000) };
    }
    const result = await ErrorLog.deleteMany(filter);
    res.json({ deleted: result.deletedCount });
  } catch (err) { next(err); }
};

// ── Backend error capture helper (used by errorHandler) ─────────────────────

/**
 * Capture a backend error and store it asynchronously (non-blocking).
 * Called from the errorHandler middleware.
 */
exports.captureBackendError = function (err, req) {
  const fingerprint = generateFingerprint(
    err.message,
    err.stack,
    req.originalUrl || req.url,
  );

  // Fire-and-forget — don't block the response
  ErrorLog.findOneAndUpdate(
    { fingerprint, source: 'backend', status: { $ne: 'resolved' } },
    {
      $inc: { count: 1 },
      $set: { lastOccurrence: new Date() },
    },
    { new: true },
  ).then((existing) => {
    if (existing) return; // Already tracked

    return ErrorLog.create({
      source: 'backend',
      level: 'error',
      message: err.message,
      name: err.name || 'Error',
      stack: err.stack,
      fingerprint,
      count: 1,
      firstOccurrence: new Date(),
      lastOccurrence: new Date(),
      statusCode: err.statusCode || err.status || 500,
      method: req.method,
      path: req.originalUrl || req.url,
      requestId: req.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      userId: req.user?._id,
      userEmail: req.user?.email,
      userRole: req.user?.role,
      environment: process.env.NODE_ENV || 'production',
      nodeVersion: process.version,
    });
  }).catch(() => {}); // Never block on error tracking
};
