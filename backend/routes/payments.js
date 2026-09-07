// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
const router = require('express').Router();
const { mpesaCallback } = require('../controllers/paymentController');
const { webhookSignatureMiddleware } = require('../middleware/webhookSignature');
const { protect } = require('../middleware/auth');
const {
  getStatus, setManualOverride, forceRefresh, getCallbackUrl,
} = require('../utils/ngrokDetector');

// Webhook signature verification (Stripe-style HMAC)
// Verifies the callback is authentic before processing
router.post('/mpesa/callback', webhookSignatureMiddleware, mpesaCallback);

// ── Callback URL Management (admin-only) ──────────────────────────────────

/**
 * GET /api/payments/mpesa/callback-url
 * Returns current callback URL resolution status:
 * - Which source is active (ngrok / manual / env)
 * - The resolved URL that will be used
 * - Whether ngrok tunnel is running
 */
router.get('/mpesa/callback-url', protect, async (req, res) => {
  try {
    const status = getStatus();
    const resolvedUrl = await getCallbackUrl('/api/payments/mpesa/callback');
    res.json({
      ...status,
      resolvedUrl,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * PUT /api/payments/mpesa/callback-url
 * Set a manual callback URL override (e.g. for ngrok).
 * Body: { "url": "https://abc123.ngrok.io" } or { "url": null } to clear.
 */
router.put('/mpesa/callback-url', protect, async (req, res) => {
  try {
    const { url } = req.body;
    setManualOverride(url || null);
    const status = getStatus();
    const resolvedUrl = await getCallbackUrl('/api/payments/mpesa/callback');
    res.json({ message: url ? 'Callback URL override set' : 'Override cleared — using auto-detection', ...status, resolvedUrl });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * POST /api/payments/mpesa/callback-url/refresh
 * Force an immediate re-check of the ngrok tunnel.
 */
router.post('/mpesa/callback-url/refresh', protect, async (req, res) => {
  try {
    const ngrokUrl = await forceRefresh();
    const status = getStatus();
    const resolvedUrl = await getCallbackUrl('/api/payments/mpesa/callback');
    res.json({ ngrokUrl, ...status, resolvedUrl });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
