// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// PCL — Webhook Signature Verification (Stripe-style HMAC)
// Supports zero-downtime secret rotation with multiple active secrets

const crypto = require('crypto');

// ── Configuration ───────────────────────────────────────────────────────────
// Signature validity window (5 minutes)
const SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000;

// Grace period for rotated secrets (24 hours)
const ROTATION_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;

// Store used signatures to prevent replay attacks
const usedSignatures = new Map(); // signature → timestamp
let cleanupInterval = null;

// In-memory cache of secrets from database
let cachedSecrets = [];
let lastSecretFetch = 0;
const SECRET_CACHE_TTL_MS = 60 * 1000; // 1 minute cache

// Start cleanup interval (only in server context, not in test scripts)
function startCleanupInterval() {
  if (cleanupInterval) return; // Already running
  const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [sig, timestamp] of usedSignatures) {
      if (now - timestamp > SIGNATURE_MAX_AGE_MS * 2) {
        usedSignatures.delete(sig);
      }
    }
  }, CLEANUP_INTERVAL_MS);
  // Allow process to exit even if interval is running
  if (cleanupInterval.unref) cleanupInterval.unref();
}

// Auto-start when imported in server context
if (require.main === module || process.env.NODE_ENV) {
  startCleanupInterval();
}

/**
 * Get all active secrets (from database with caching)
 * Falls back to env variable if database is unavailable
 */
async function getActiveSecrets() {
  const now = Date.now();

  // Return cached secrets if still valid
  if (cachedSecrets.length > 0 && now - lastSecretFetch < SECRET_CACHE_TTL_MS) {
    return cachedSecrets;
  }

  try {
    const WebhookSecret = require('../models/WebhookSecret');
    const secrets = await WebhookSecret.find({
      status: { $in: ['active', 'rotate'] },
      $or: [
        { expiresAt: { $gt: new Date() } },
        { expiresAt: { $exists: false } },
      ],
    }).sort({ createdAt: -1 });

    if (secrets.length > 0) {
      cachedSecrets = secrets.map((s) => ({
        secret: s.secret,
        status: s.status,
        _id: s._id,
      }));
      lastSecretFetch = now;
      return cachedSecrets;
    }
  } catch (err) {
    // Database not available, fall back to env variable
    console.warn('[WEBHOOK] Failed to fetch secrets from database:', err.message);
  }

  // Fallback to environment variable
  const envSecret = process.env.MPESA_WEBHOOK_SECRET || crypto.randomBytes(32).toString('hex');
  cachedSecrets = [{ secret: envSecret, status: 'active', _id: 'env' }];
  lastSecretFetch = now;
  return cachedSecrets;
}

/**
 * Get the current primary secret (for generating new signatures)
 */
async function getPrimarySecret() {
  const secrets = await getActiveSecrets();
  // Return the first active secret
  const active = secrets.find((s) => s.status === 'active');
  return active ? active.secret : (process.env.MPESA_WEBHOOK_SECRET || crypto.randomBytes(32).toString('hex'));
}

/**
 * Generate HMAC signature for callback URL
 * @param {string} checkoutRequestId - The checkout request ID
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @param {string} secret - Optional specific secret (uses primary if not provided)
 * @returns {string} Hex-encoded HMAC signature
 */
async function generateSignature(checkoutRequestId, timestamp, secret) {
  const sigSecret = secret || await getPrimarySecret();
  const payload = `${checkoutRequestId}:${timestamp}`;
  return crypto
    .createHmac('sha256', sigSecret)
    .update(payload)
    .digest('hex');
}

/**
 * Generate a signed callback URL with signature as query parameter
 * @param {string} baseUrl - The base callback URL
 * @param {string} checkoutRequestId - The checkout request ID
 * @returns {string} Signed callback URL with signature and timestamp
 */
async function generateSignedCallbackUrl(baseUrl, checkoutRequestId) {
  const timestamp = Date.now();
  const signature = await generateSignature(checkoutRequestId, timestamp);

  // Append signature and timestamp as query parameters
  const url = new URL(baseUrl);
  url.searchParams.set('sig', signature);
  url.searchParams.set('ts', timestamp.toString());

  return url.toString();
}

/**
 * Update secret usage statistics (non-blocking)
 */
async function updateSecretUsage(secretId) {
  try {
    const WebhookSecret = require('../models/WebhookSecret');
    await WebhookSecret.findByIdAndUpdate(secretId, {
      $inc: { usageCount: 1 },
      lastUsedAt: new Date(),
    });
  } catch {
    // Non-critical, ignore errors
  }
}

/**
 * Verify webhook signature from callback request
 * Tries all active/rotated secrets (supports rotation)
 * @param {string} checkoutRequestId - The checkout request ID from callback body
 * @param {string} signature - The signature from query parameter
 * @param {string} timestamp - The timestamp from query parameter
 * @returns {{ valid: boolean, reason?: string, secretId?: string }}
 */
async function verifySignature(checkoutRequestId, signature, timestamp) {
  // Validate inputs
  if (!checkoutRequestId || !signature || !timestamp) {
    return { valid: false, reason: 'Missing signature components' };
  }

  // Parse timestamp
  const ts = parseInt(timestamp, 10);
  if (Number.isNaN(ts)) {
    return { valid: false, reason: 'Invalid timestamp format' };
  }

  // Check signature age (prevent replay attacks)
  const age = Date.now() - ts;
  if (age < 0) {
    return { valid: false, reason: 'Signature from future' };
  }
  if (age > SIGNATURE_MAX_AGE_MS) {
    return { valid: false, reason: `Signature expired (${Math.floor(age / 1000)}s old, max ${SIGNATURE_MAX_AGE_MS / 1000}s)` };
  }

  // Check for signature reuse (replay protection)
  if (usedSignatures.has(signature)) {
    return { valid: false, reason: 'Signature already used (replay detected)' };
  }

  // Get all secrets to try (supports rotation)
  const secrets = await getActiveSecrets();

  for (const secretObj of secrets) {
    // Recompute expected signature with this secret
    const expectedSignature = crypto
      .createHmac('sha256', secretObj.secret)
      .update(`${checkoutRequestId}:${timestamp}`)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    try {
      if (Buffer.from(signature, 'hex').length === Buffer.from(expectedSignature, 'hex').length) {
        const isValid = crypto.timingSafeEqual(
          Buffer.from(signature, 'hex'),
          Buffer.from(expectedSignature, 'hex'),
        );

        if (isValid) {
          // Mark signature as used (prevent replay)
          usedSignatures.set(signature, Date.now());

          // Update usage stats in database (non-blocking)
          if (secretObj._id && secretObj._id !== 'env') {
            updateSecretUsage(secretObj._id).catch(() => {});
          }

          return { valid: true, secretId: secretObj._id, secretStatus: secretObj.status };
        }
      }
    } catch {
      // Comparison failed, continue to next secret
    }
  }

  return { valid: false, reason: 'Signature mismatch (no matching secret)' };
}

/**
 * Clear secrets cache (called after rotation)
 */
function clearSecretsCache() {
  cachedSecrets = [];
  lastSecretFetch = 0;
}

/**
 * Express middleware to verify webhook signatures
 */
async function webhookSignatureMiddleware(req, res, next) {
  try {
    const signature = req.query.sig;
    const timestamp = req.query.ts;

    // Get checkoutRequestId from body
    const checkoutRequestId = req.body?.Body?.stkCallback?.CheckoutRequestID;

    if (!checkoutRequestId) {
      // No checkout request ID — cannot verify, always reject
      return res.status(400).json({
        message: 'Webhook payload missing CheckoutRequestID',
        code: 'WEBHOOK_MISSING_REQUEST_ID',
      });
    }

    const result = await verifySignature(checkoutRequestId, signature, timestamp);
    req.webhookVerification = result;

    if (!result.valid) {
      console.warn(`[WEBHOOK] Signature verification failed: ${result.reason}`);

      // Reject in production and test — only allow through in explicit development mode
      if (process.env.NODE_ENV !== 'development') {
        return res.status(403).json({
          message: 'Webhook signature verification failed',
          code: 'WEBHOOK_SIGNATURE_INVALID',
        });
      }

      // In development only, log warning but continue (for sandbox testing)
      console.warn('[WEBHOOK] Allowing request in development mode despite invalid signature');
    } else {
      console.log(`[WEBHOOK] Signature verified for ${checkoutRequestId} (secret: ${result.secretId}, status: ${result.secretStatus})`);
    }

    next();
  } catch (error) {
    console.error('[WEBHOOK] Signature verification error:', error.message);
    // Don't block the request on verification errors in development
    if (process.env.NODE_ENV === 'production') {
      return res.status(500).json({ message: 'Webhook verification error' });
    }
    next();
  }
}

/**
 * Get the primary webhook secret (for testing/debugging)
 */
async function getWebhookSecret() {
  return getPrimarySecret();
}

/**
 * Rotate webhook secret with zero downtime
 */
async function rotateWebhookSecret(createdBy, label) {
  const newSecret = crypto.randomBytes(32).toString('hex');

  try {
    const WebhookSecret = require('../models/WebhookSecret');
    const rotated = await WebhookSecret.rotate(newSecret, createdBy, label);

    // Clear cache to force refresh
    clearSecretsCache();

    return {
      success: true,
      secretId: rotated._id,
      label: rotated.label,
      message: 'Webhook secret rotated successfully. Old secrets will be accepted for 24 hours.',
    };
  } catch (err) {
    console.error('[WEBHOOK] Rotation failed:', err);
    return { success: false, message: 'Failed to rotate webhook secret' };
  }
}

module.exports = {
  generateSignature,
  generateSignedCallbackUrl,
  verifySignature,
  webhookSignatureMiddleware,
  getWebhookSecret,
  getPrimarySecret,
  rotateWebhookSecret,
  clearSecretsCache,
  SIGNATURE_MAX_AGE_MS,
  ROTATION_GRACE_PERIOD_MS,
};
