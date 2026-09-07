// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// Brute-force protection — progressive delay on repeated failed login attempts.
//
// How it works:
//   1. Track failed login attempts per IP in memory (no Redis needed)
//   2. After each failure, exponentially increase the delay before accepting the next attempt
//   3. After too many failures, temporarily block the IP entirely
//   4. Reset counter on successful login (called from auth controller)
//   5. Auto-cleanup of stale entries every 5 minutes
//
// Delay schedule (exponential backoff):
//   Attempt 1: 0ms (first failure, no delay)
//   Attempt 2: 1s
//   Attempt 3: 2s
//   Attempt 4: 4s
//   Attempt 5: 8s
//   Attempt 6: 16s
//   Attempt 7+: 30s (capped)
//   After 10 failures: blocked for 15 minutes
//
// This is complementary to the auth rate limiter (10 attempts/15 min).
// Rate limiter blocks by count; this adds progressive delay + temporary IP ban.

const logger = require('../utils/logger');

// ── Configuration ──────────────────────────────────────────────────────────

const MAX_ATTEMPTS = parseInt(process.env.BRUTE_MAX_ATTEMPTS || '10', 10);
const BLOCK_DURATION_MS = parseInt(process.env.BRUTE_BLOCK_DURATION_MS || '900000', 10); // 15 minutes
const WINDOW_MS = parseInt(process.env.BRUTE_WINDOW_MS || '900000', 10); // 15 min tracking window
const BASE_DELAY_MS = 1000; // 1 second base delay
const MAX_DELAY_MS = 30000; // 30 second max delay
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Cleanup every 5 minutes

// ── In-memory store ────────────────────────────────────────────────────────
// Key: IP address
// Value: { attempts, firstAttemptAt, lastAttemptAt, blockedUntil }
const attempts = new Map();

// ── Helpers ────────────────────────────────────────────────────────────────

function getClientIp(req) {
  // Support proxied requests (X-Forwarded-For)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ip = forwarded.split(',')[0].trim();
    if (ip) return ip;
  }
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

function getRecord(ip) {
  let record = attempts.get(ip);
  const now = Date.now();

  if (!record) {
    record = { attempts: 0, firstAttemptAt: now, lastAttemptAt: now, blockedUntil: 0 };
    attempts.set(ip, record);
    return record;
  }

  // Reset if window has expired
  if (now - record.firstAttemptAt > WINDOW_MS) {
    record.attempts = 0;
    record.firstAttemptAt = now;
    record.blockedUntil = 0;
  }

  return record;
}

/**
 * Calculate progressive delay based on attempt count.
 * Uses exponential backoff: base * 2^(attempts-1), capped at MAX_DELAY_MS.
 */
function calculateDelay(attempts) {
  if (attempts <= 1) return 0;
  const delay = BASE_DELAY_MS * Math.pow(2, attempts - 2);
  return Math.min(delay, MAX_DELAY_MS);
}

// ── Cleanup stale entries ──────────────────────────────────────────────────

function cleanup() {
  const now = Date.now();
  let cleaned = 0;
  for (const [ip, record] of attempts) {
    // Remove entries older than the window and not blocked
    if (now - record.lastAttemptAt > WINDOW_MS && now > record.blockedUntil) {
      attempts.delete(ip);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    logger.debug(`Brute-force cleanup: removed ${cleaned} stale entries, ${attempts.size} active`);
  }
}

// Run cleanup every 5 minutes
setInterval(cleanup, CLEANUP_INTERVAL_MS);

// ── Middleware ──────────────────────────────────────────────────────────────

/**
 * Express middleware — checks if the IP is blocked due to brute-force attempts.
 * Applies progressive delay before allowing the request through.
 *
 * Place this BEFORE the login handler in the route chain.
 */
function bruteForceProtection(req, res, next) {
  const ip = getClientIp(req);
  const record = getRecord(ip);
  const now = Date.now();

  // Check if IP is currently blocked
  if (record.blockedUntil > now) {
    const remainingSeconds = Math.ceil((record.blockedUntil - now) / 1000);
    logger.warn(`Brute-force: IP ${ip} blocked for ${remainingSeconds}s more`, {
      attempts: record.attempts,
      blockedUntil: new Date(record.blockedUntil).toISOString(),
    });

    res.set('Retry-After', String(remainingSeconds));
    return res.status(429).json({
      message: `Too many failed attempts. Try again in ${remainingSeconds} seconds.`,
      code: 'BRUTE_FORCE_BLOCKED',
      retryAfter: remainingSeconds,
      blockedUntil: new Date(record.blockedUntil).toISOString(),
    });
  }

  // Calculate and apply progressive delay
  const delay = calculateDelay(record.attempts);
  if (delay > 0) {
    logger.warn(`Brute-force: IP ${ip} delayed ${delay}ms (${record.attempts} failed attempts)`, {
      attempts: record.attempts,
      delay,
    });

    // Add delay header so client knows about the penalty
    res.set('X-Brute-Force-Delay', String(Math.ceil(delay / 1000)));
  }

  // Store the IP on the request for the controller to call recordFailure/success
  req._bruteForceIp = ip;
  req._bruteForceRecord = record;

  if (delay > 0) {
    setTimeout(() => next(), delay);
  } else {
    next();
  }
}

// ── Controller helpers ─────────────────────────────────────────────────────

/**
 * Record a failed login attempt for the given IP.
 * Called from the auth controller after a failed login.
 */
function recordFailure(ip) {
  const record = getRecord(ip);
  record.attempts += 1;
  record.lastAttemptAt = Date.now();

  // Block if too many attempts
  if (record.attempts >= MAX_ATTEMPTS) {
    record.blockedUntil = Date.now() + BLOCK_DURATION_MS;
    logger.warn(`Brute-force: IP ${ip} BLOCKED for ${BLOCK_DURATION_MS / 1000}s after ${record.attempts} failures`, {
      attempts: record.attempts,
      blockedUntil: new Date(record.blockedUntil).toISOString(),
    });
  } else {
    const nextDelay = calculateDelay(record.attempts + 1);
    logger.info(`Brute-force: IP ${ip} failure recorded (${record.attempts}/${MAX_ATTEMPTS}), next delay: ${nextDelay}ms`);
  }

  return record;
}

/**
 * Reset failed attempts for an IP (called on successful login).
 */
function recordSuccess(ip) {
  const record = attempts.get(ip);
  if (record && record.attempts > 0) {
    logger.info(`Brute-force: IP ${ip} login successful — resetting ${record.attempts} failed attempts`);
    record.attempts = 0;
    record.firstAttemptAt = Date.now();
    record.blockedUntil = 0;
  }
}

/**
 * Get current status for an IP (for admin dashboard / debugging).
 */
function getStatus(ip) {
  const record = attempts.get(ip);
  if (!record) return { ip, attempts: 0, blocked: false };

  return {
    ip,
    attempts: record.attempts,
    maxAttempts: MAX_ATTEMPTS,
    blocked: record.blockedUntil > Date.now(),
    blockedUntil: record.blockedUntil > 0 ? new Date(record.blockedUntil).toISOString() : null,
    nextDelay: calculateDelay(record.attempts + 1),
    windowExpiresAt: new Date(record.firstAttemptAt + WINDOW_MS).toISOString(),
  };
}

/**
 * Get all active brute-force records (for admin dashboard).
 */
function getAllStatus() {
  const now = Date.now();
  const active = [];
  for (const [ip, record] of attempts) {
    if (record.attempts > 0 || record.blockedUntil > now) {
      active.push({
        ip,
        attempts: record.attempts,
        blocked: record.blockedUntil > now,
        blockedUntil: record.blockedUntil > now ? new Date(record.blockedUntil).toISOString() : null,
        nextDelay: calculateDelay(record.attempts + 1),
      });
    }
  }
  return {
    activeIPs: active.length,
    records: active.sort((a, b) => b.attempts - a.attempts),
    config: {
      maxAttempts: MAX_ATTEMPTS,
      blockDuration: BLOCK_DURATION_MS,
      window: WINDOW_MS,
    },
  };
}

module.exports = {
  bruteForceProtection,
  recordFailure,
  recordSuccess,
  getStatus,
  getAllStatus,
  calculateDelay,
  MAX_ATTEMPTS,
  BLOCK_DURATION_MS,
};
