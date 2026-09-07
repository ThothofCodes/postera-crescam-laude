// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// CSRF Protection — Double-Submit Cookie Pattern
//
// How it works:
//   1. GET /api/csrf-token → sets a readable _csrf cookie + returns token in JSON
//   2. Frontend reads the cookie and sends X-CSRF-Token header on every mutation
//   3. Middleware compares cookie value ↔ header value
//   4. Mismatches are rejected with 403
//
// Why this is safe:
//   - An attacker on a different origin CANNOT read cookies (SameSite=Lax)
//   - An attacker on a different origin CANNOT set custom headers (no CORS preflight)
//   - Only same-origin JavaScript can read the cookie AND set the header

const crypto = require('crypto');

const CSRF_COOKIE = '_csrf';
const CSRF_HEADER = 'x-csrf-token';
const CSRF_SECRET = process.env.CSRF_SECRET || process.env.JWT_SECRET;
const TOKEN_LENGTH = 32;
const COOKIE_MAX_AGE = 60 * 60 * 1000; // 1 hour

// Methods that must be protected (state-changing)
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Paths exempt from CSRF (webhooks, callbacks from external services)
const EXEMPT_PATHS = [
  '/auth/login', // Pre-authentication — no session to hijack
  '/auth/register', // Pre-authentication — admin-only, rate-limited
  '/auth/csrf-token', // Token fetch endpoint (GET only, but exempt anyway)
  '/payments/mpesa/callback',
  '/billing/mpesa-callback',
  '/webhook',
  '/ussd',
  '/chat/callback',
  '/monetization/ads/impression', // Public tracking — anonymous users
  '/monetization/ads/click', // Public tracking — anonymous users
  '/monetization/promos/validate', // Pre-checkout validation — may be anonymous
  '/analytics/events', // Frontend event tracking — no auth/CSRF
  '/errors', // Frontend error ingestion — no auth/CSRF
  '/orders/pay/', // Public STK push retry — checkout is unauthenticated
  '/orders/retry-payment/', // Public STK push retry — checkout is unauthenticated
  '/orders/switch-to-cash/', // Public payment switch — checkout is unauthenticated
];

/**
 * Generate a signed CSRF token.
 * The token is an HMAC of a random nonce — verifiable without server-side state.
 */
function generateToken() {
  const nonce = crypto.randomBytes(TOKEN_LENGTH).toString('hex');
  const signature = crypto.createHmac('sha256', CSRF_SECRET).update(nonce).digest('hex');
  return `${nonce}.${signature}`;
}

/**
 * Verify a CSRF token against its signature.
 */
function verifyToken(token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [nonce, signature] = parts;
  const expected = crypto.createHmac('sha256', CSRF_SECRET).update(nonce).digest('hex');
  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Parse a cookie string into an object.
 */
function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach((pair) => {
    const [key, ...rest] = pair.split('=');
    const value = rest.join('=').trim();
    if (key) cookies[key.trim()] = decodeURIComponent(value);
  });
  return cookies;
}

/**
 * Set the CSRF cookie on the response.
 * This cookie is NOT httpOnly — the frontend must read it to put in the header.
 */
function setCsrfCookie(res) {
  const token = generateToken();
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie(CSRF_COOKIE, token, {
    maxAge: COOKIE_MAX_AGE,
    sameSite: 'lax',
    path: '/',
    secure: isProduction,
    // NOT httpOnly — frontend needs to read it
  });
  return token;
}

/**
 * Express middleware — validates CSRF on state-changing requests.
 */
function csrfProtection(req, res, next) {
  // Safe methods are always allowed
  if (SAFE_METHODS.has(req.method)) return next();

  // Exempt external webhook/callback paths
  const isExempt = EXEMPT_PATHS.some((p) => req.path.includes(p));
  if (isExempt) return next();

  // Read token from cookie
  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies[CSRF_COOKIE];

  // Read token from header
  const headerToken = req.headers[CSRF_HEADER];

  // Both must be present and match
  if (!cookieToken || !headerToken) {
    return res.status(403).json({
      message: 'CSRF token missing. Please refresh the page and try again.',
      code: 'CSRF_MISSING',
    });
  }

  if (!verifyToken(cookieToken) || !verifyToken(headerToken)) {
    return res.status(403).json({
      message: 'CSRF token invalid. Please refresh the page and try again.',
      code: 'CSRF_INVALID',
    });
  }

  // Constant-time comparison of cookie vs header
  try {
    const match = crypto.timingSafeEqual(
      Buffer.from(cookieToken),
      Buffer.from(headerToken),
    );
    if (!match) {
      return res.status(403).json({
        message: 'CSRF token mismatch. Please refresh the page and try again.',
        code: 'CSRF_MISMATCH',
      });
    }
  } catch {
    return res.status(403).json({
      message: 'CSRF validation failed.',
      code: 'CSRF_ERROR',
    });
  }

  next();
}

module.exports = {
  csrfProtection,
  setCsrfCookie,
  generateToken,
  verifyToken,
  CSRF_COOKIE,
  CSRF_HEADER,
};
