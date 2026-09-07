// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// Unified error handler — standardized JSON error responses with codes and request context.

const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');
const { captureBackendError } = require('../controllers/errorTracker');

const errorHandler = (err, req, res, next) => {
  const isDev = process.env.NODE_ENV === 'development';
  const timestamp = new Date().toISOString();
  const path = req.originalUrl || req.url;

  // ── Log full error server-side ──────────────────────────────────────────────
  logger.error(`${req.method} ${path} — ${err.message}`, {
    requestId: req.id,
    statusCode: err.statusCode || err.status || 500,
    stack: err.stack,
  });

  // ── Capture to error tracking database (non-blocking) ────────────────────
  captureBackendError(err, req);

  // ── AppError (our custom operational errors) ────────────────────────────────
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: err.statusCode,
      code: err.code,
      message: err.message,
      details: err.details.length ? err.details : undefined,
      timestamp,
      path,
      requestId: req.id,
    });
  }

  // ── Mongoose: buffering timeout = DB not connected ──────────────────────────
  if (err.name === 'MongooseError' && err.message.includes('buffering timed out')) {
    return res.status(503).json({
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      message: 'Service temporarily unavailable. Please try again shortly.',
      timestamp,
      path,
      requestId: req.id,
    });
  }

  // ── Mongoose: validation error ───────────────────────────────────────────────
  if (err.name === 'ValidationError') {
    const details = Object.entries(err.errors).map(([field, e]) => ({
      field,
      message: e.message,
      kind: e.kind,
    }));
    return res.status(400).json({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: Object.values(err.errors).map((e) => e.message).join(', '),
      details,
      timestamp,
      path,
      requestId: req.id,
    });
  }

  // ── Mongoose: duplicate key ──────────────────────────────────────────────
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({
      status: 409,
      code: 'CONFLICT',
      message: `${field} already exists`,
      details: [{ field, value: err.keyValue?.[field] }],
      timestamp,
      path,
      requestId: req.id,
    });
  }

  // ── Mongoose: bad ObjectId ───────────────────────────────────────────────
  if (err.name === 'CastError') {
    return res.status(400).json({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Invalid ID format',
      details: [{ field: err.path, value: err.value }],
      timestamp,
      path,
      requestId: req.id,
    });
  }

  // ── JWT errors ───────────────────────────────────────────────────────────
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'Invalid token',
      timestamp,
      path,
      requestId: req.id,
    });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      status: 401,
      code: 'TOKEN_EXPIRED',
      message: 'Session expired',
      timestamp,
      path,
      requestId: req.id,
    });
  }

  // ── Multer: file too large ───────────────────────────────────────────────
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      status: 400,
      code: 'FILE_TOO_LARGE',
      message: 'File too large. Maximum size is 5MB.',
      timestamp,
      path,
      requestId: req.id,
    });
  }

  // ── CORS error ───────────────────────────────────────────────────────────
  if (err.message?.startsWith('CORS:')) {
    return res.status(403).json({
      status: 403,
      code: 'CORS_VIOLATION',
      message: 'CORS policy violation',
      timestamp,
      path,
      requestId: req.id,
    });
  }

  // ── Generic — NEVER expose stack trace in production ────────────────────
  const status = err.statusCode || err.status || 500;
  res.status(status).json({
    status,
    code: 'INTERNAL_ERROR',
    message: isDev ? err.message : 'An error occurred. Please try again.',
    ...(isDev && { stack: err.stack }),
    timestamp,
    path,
    requestId: req.id,
  });
};

module.exports = errorHandler;
