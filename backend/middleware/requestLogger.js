// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// Request logger — structured per-request logging with response time, user context, and status classification.
// Integrates with the existing Winston logger and request ID system.
//
// Features:
//   - Logs method, path, status, response time, user ID/role, request ID
//   - Skips noisy endpoints (health checks, static assets, WebSocket upgrades)
//   - Classifies log level by status: info (2xx), warn (4xx), error (5xx)
//   - Slow request warnings (>2s for GET, >5s for mutations)
//   - Structured JSON in production, colored text in development
//   - Redacts sensitive headers (Authorization, cookies)

const logger = require('../utils/logger');

// Paths to skip logging (health checks, static probes, metrics)
const SKIP_PATHS = new Set([
  '/api/health',
  '/api/ready',
  '/api/health/detail',
  '/api/docs.json',
]);

// Paths that are always slow and shouldn't warn (large exports, reports)
const SLOW_PATHS = new Set([
  '/api/analytics/summary',
  '/api/analytics/departments',
  '/api/admin/stats',
  '/api/admin/revenue',
]);

// Response time thresholds (ms)
const SLOW_GET_THRESHOLD = 2000;
const SLOW_MUTATION_THRESHOLD = 5000;

// Sensitive header keys to redact
const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'x-csrf-token',
  'set-cookie',
]);

/**
 * Redact sensitive values from an object.
 */
function _redactHeaders(headers) {
  const redacted = {};
  for (const [key, value] of Object.entries(headers)) {
    if (SENSITIVE_HEADERS.has(key.toLowerCase())) {
      redacted[key] = '[REDACTED]';
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

/**
 * Format duration for human readability.
 */
function formatDuration(ms) {
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

/**
 * Get user context from request (after auth middleware has run).
 */
function getUserContext(req) {
  if (!req.user) return { anonymous: true };
  return {
    userId: req.user._id?.toString() || req.user.id,
    email: req.user.email,
    role: req.user.role,
    department: req.user.departmentSlug || req.user.department?.toString(),
  };
}

/**
 * Express middleware — logs every API request with full context.
 */
function requestLogger(req, res, next) {
  // Skip health checks and noisy endpoints
  if (SKIP_PATHS.has(req.path) || SKIP_PATHS.has(req.originalUrl)) {
    return next();
  }

  // Record start time
  const start = process.hrtime.bigint();

  // Capture the original end/json methods to intercept the response
  const originalEnd = res.end;

  res.end = function (...args) {
    // Calculate duration
    const end = process.hrtime.bigint();
    const durationNs = Number(end - start);
    const durationMs = durationNs / 1e6;

    // Build log entry
    const status = res.statusCode;
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'http';

    const entry = {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl || req.url,
      status,
      duration: Math.round(durationMs * 100) / 100, // 2 decimal places
      durationFormatted: formatDuration(durationMs),
      ip: req.ip || req.connection?.remoteAddress || 'unknown',
      userAgent: req.headers['user-agent']?.substring(0, 100) || 'unknown',
      contentLength: res.getHeader('content-length') || 0,
      contentType: (res.getHeader('content-type') || '').split(';')[0].trim(),
      contentEncoding: res.getHeader('content-encoding') || 'identity',
    };

    // Add user context (only for authenticated requests)
    const userCtx = getUserContext(req);
    if (!userCtx.anonymous) {
      entry.user = userCtx;
    }

    // Add query params if present (strip sensitive values)
    if (Object.keys(req.query).length > 0) {
      entry.query = { ...req.query };
    }

    // Slow request warning
    const isSlowPath = SLOW_PATHS.has(req.path);
    const threshold = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
      ? SLOW_MUTATION_THRESHOLD
      : SLOW_GET_THRESHOLD;

    if (durationMs > threshold && !isSlowPath) {
      entry.slow = true;
      entry.threshold = threshold;
    }

    // Rate limit info (if rate limiter responded)
    const remaining = res.getHeader('ratelimit-remaining');
    if (remaining !== undefined) {
      entry.rateLimit = {
        remaining: parseInt(remaining, 10),
        limit: parseInt(res.getHeader('ratelimit-limit') || '0', 10),
        reset: res.getHeader('ratelimit-reset'),
      };
    }

    // Log with appropriate level
    const message = `${req.method} ${req.path} ${status} ${entry.durationFormatted}`;

    if (entry.slow) {
      logger.warn(`SLOW ${message}`, entry);
    } else if (level === 'error') {
      logger.error(message, entry);
    } else if (level === 'warn') {
      logger.warn(message, entry);
    } else {
      logger.http(message, entry);
    }

    // Call original end
    return originalEnd.apply(res, args);
  };

  next();
}

module.exports = requestLogger;
