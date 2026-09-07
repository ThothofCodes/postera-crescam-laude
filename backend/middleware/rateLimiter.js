// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// Role-aware rate limiter — different quotas for PUBLIC / STAFF / DEPT_HEAD / SUPER_ADMIN.
// Uses express-rate-limit's built-in MemoryStore. For multi-instance deployments,
// swap to RedisStore (rate-limit-redis) — no code changes needed beyond the store option.

const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');

// ── Rate limit tiers (requests per 15-minute window) ───────────────────────
// PUBLIC = unauthenticated (no valid JWT)
// STAFF  = STAFF, staff
// DEPT   = DEPT_HEAD_OWNER, admin
// ADMIN  = SUPER_ADMIN
const TIERS = {
  PUBLIC: { max: 200, label: 'public' }, // Anonymous browsers, webhooks
  STAFF: { max: 200, label: 'staff' }, // Regular staff — higher quota for dashboard usage
  DEPT: { max: 400, label: 'dept' }, // Dept heads — bulk operations, reporting
  ADMIN: { max: 800, label: 'admin' }, // Super admins — full access, seeding, bulk imports
};

// Sensitive write operations get tighter limits regardless of role
const WRITE_TIERS = {
  PUBLIC: { max: 50, label: 'public-write' },
  STAFF: { max: 30, label: 'staff-write' },
  DEPT: { max: 60, label: 'dept-write' },
  ADMIN: { max: 100, label: 'admin-write' },
};

// Auth endpoints (login, register, password reset) — very strict
const AUTH_TIER = { max: 8, label: 'auth', windowMs: 15 * 60 * 1000 };

// Heavy endpoints (file uploads, bulk imports, exports)
const HEAVY_TIER = { max: 10, label: 'heavy', windowMs: 15 * 60 * 1000 };

// Webhook/callback endpoints (Safaricom, external services)
const WEBHOOK_TIER = { max: 200, label: 'webhook', windowMs: 15 * 60 * 1000 };

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Extract and verify the JWT from cookie or Authorization header.
 * Returns the decoded payload or null.
 */
function extractUserFromRequest(req) {
  // Try httpOnly cookie
  let token = null;
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    for (const pair of cookieHeader.split(';')) {
      const [key, ...rest] = pair.split('=');
      if (key?.trim() === 'pcl_token') {
        token = rest.join('=').trim();
        break;
      }
    }
  }
  // Fallback to Authorization header
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      [, token] = authHeader.split(' ');
    }
  }
  if (!token) return null;

  try {
    return jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return null;
  }
}

/**
 * Determine the user's rate limit tier based on JWT role.
 */
function getTier(decoded) {
  if (!decoded) return TIERS.PUBLIC;
  const { role } = decoded;
  if (role === 'SUPER_ADMIN') return TIERS.ADMIN;
  if (['DEPT_HEAD_OWNER', 'admin'].includes(role)) return TIERS.DEPT;
  if (['STAFF', 'staff'].includes(role)) return TIERS.STAFF;
  return TIERS.PUBLIC;
}

/**
 * Determine write-operation tier.
 */
function getWriteTier(decoded) {
  if (!decoded) return WRITE_TIERS.PUBLIC;
  const { role } = decoded;
  if (role === 'SUPER_ADMIN') return WRITE_TIERS.ADMIN;
  if (['DEPT_HEAD_OWNER', 'admin'].includes(role)) return WRITE_TIERS.DEPT;
  if (['STAFF', 'staff'].includes(role)) return WRITE_TIERS.STAFF;
  return WRITE_TIERS.PUBLIC;
}

// ── Key generators ─────────────────────────────────────────────────────────

/**
 * Key by user ID (authenticated) or IP (anonymous).
 * Prevents one user from burning another's quota when sharing an IP.
 */
function userOrIpKey(req) {
  const decoded = extractUserFromRequest(req);
  if (decoded?.id) return `user:${decoded.id}`;
  return `ip:${req.ip || 'unknown'}`;
}

/**
 * Key by IP only — for auth endpoints where we don't trust the JWT yet.
 */
function ipKey(req) {
  return `ip:${req.ip || 'unknown'}`;
}

// ── Response header formatter ──────────────────────────────────────────────

function _addRateLimitHeaders(req, res, info) {
  res.set('RateLimit-Policy', info.label || 'global');
}

// ── Pre-built limiters (applied in server.js) ──────────────────────────────

/**
 * Global rate limiter — role-aware, applies to ALL /api/ requests.
 * Replaces the old limiter that skipped authenticated users entirely.
 */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: (req) => {
    const decoded = extractUserFromRequest(req);
    return getTier(decoded).max;
  },
  keyGenerator: userOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Rate limit exceeded. Please slow down.', code: 'RATE_LIMITED' },
  handler: (req, res, next, options) => {
    const decoded = extractUserFromRequest(req);
    const tier = getTier(decoded);
    const retryAfter = Math.ceil(options.windowMs / 1000);
    res.set('Retry-After', String(retryAfter));
    res.set('RateLimit-Policy', tier.label);
    res.status(options.statusCode).json({
      message: `Rate limit exceeded (${tier.max} requests per 15 min for ${tier.label}). Try again in ${retryAfter}s.`,
      code: 'RATE_LIMITED',
      limit: tier.max,
      remaining: 0,
      reset: new Date(Date.now() + options.windowMs).toISOString(),
      retryAfter,
    });
  },
});

/**
 * Write-operation rate limiter — tighter limits for POST/PUT/PATCH/DELETE.
 * Stacked on top of the global limiter.
 */
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: (req) => {
    const decoded = extractUserFromRequest(req);
    return getWriteTier(decoded).max;
  },
  keyGenerator: userOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Write rate limit exceeded.', code: 'WRITE_RATE_LIMITED' },
  handler: (req, res, next, options) => {
    const decoded = extractUserFromRequest(req);
    const tier = getWriteTier(decoded);
    const retryAfter = Math.ceil(options.windowMs / 1000);
    res.set('Retry-After', String(retryAfter));
    res.set('RateLimit-Policy', tier.label);
    res.status(options.statusCode).json({
      message: `Write rate limit exceeded (${tier.max} writes per 15 min for ${tier.label}). Try again in ${retryAfter}s.`,
      code: 'WRITE_RATE_LIMITED',
      limit: tier.max,
      remaining: 0,
      reset: new Date(Date.now() + options.windowMs).toISOString(),
      retryAfter,
    });
  },
});

/**
 * Auth rate limiter — strict, IP-based (no JWT trust at this point).
 */
const authLimiter = rateLimit({
  windowMs: AUTH_TIER.windowMs,
  max: AUTH_TIER.max,
  keyGenerator: ipKey,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { message: 'Too many login attempts. Try again after 15 minutes.', code: 'AUTH_RATE_LIMITED' },
  handler: (req, res, next, options) => {
    const retryAfter = Math.ceil(options.windowMs / 1000);
    res.set('Retry-After', String(retryAfter));
    res.set('RateLimit-Policy', 'auth');
    res.status(options.statusCode).json({
      message: `Too many authentication attempts (${AUTH_TIER.max} per 15 min). Try again in ${retryAfter}s.`,
      code: 'AUTH_RATE_LIMITED',
      limit: AUTH_TIER.max,
      remaining: 0,
      reset: new Date(Date.now() + options.windowMs).toISOString(),
      retryAfter,
    });
  },
});

/**
 * Heavy endpoint limiter — file uploads, bulk imports, exports.
 */
const heavyLimiter = rateLimit({
  windowMs: HEAVY_TIER.windowMs,
  max: (req) => {
    const decoded = extractUserFromRequest(req);
    const tier = getTier(decoded);
    // Heavy operations: use 1/4 of normal tier max, minimum 3
    return Math.max(3, Math.floor(tier.max / 4));
  },
  keyGenerator: userOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many heavy operations. Please wait.', code: 'HEAVY_RATE_LIMITED' },
});

/**
 * Webhook rate limiter — generous for external service callbacks.
 */
const webhookLimiter = rateLimit({
  windowMs: WEBHOOK_TIER.windowMs,
  max: WEBHOOK_TIER.max,
  keyGenerator: ipKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many webhook callbacks.' },
});

module.exports = {
  globalLimiter,
  writeLimiter,
  authLimiter,
  heavyLimiter,
  webhookLimiter,
  extractUserFromRequest,
  getTier,
  getWriteTier,
  TIERS,
  WRITE_TIERS,
};
