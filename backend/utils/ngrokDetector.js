// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// ═══════════════════════════════════════════════════════════════════════════
// Ngrok Auto-Detector for M-Pesa Callback URL
// ═══════════════════════════════════════════════════════════════════════════
// Polls the ngrok local API (localhost:4040) to find the current tunnel URL.
// Falls back to MPESA_CALLBACK_URL from .env when ngrok is not running.
//
// Usage:
//   const { getCallbackUrl, getStatus } = require('./ngrokDetector');
//   const url = await getCallbackUrl('/api/payments/mpesa/callback');
//   // → https://abc123.ngrok.io/api/payments/mpesa/callback
// ═══════════════════════════════════════════════════════════════════════════

const axios = require('axios');

// ── State ──────────────────────────────────────────────────────────────────
let cachedUrl = null;          // The raw ngrok tunnel URL (no path)
let lastChecked = 0;
let manualOverride = null;     // Admin-set override URL
const POLL_INTERVAL_MS = 30_000; // Re-check every 30 seconds
const NGROK_API = 'http://127.0.0.1:4040/api/tunnels';

// ── Core Detection ─────────────────────────────────────────────────────────

/**
 * Query the ngrok local API for the current public tunnel URL.
 * ngrok v2+ exposes this at localhost:4040.
 * @returns {string|null} e.g. "https://abc123.ngrok-free.app" or null
 */
async function fetchNgrokUrl() {
  try {
    const { data } = await axios.get(NGROK_API, { timeout: 2000 });
    // ngrok API returns { tunnels: [{ name, public_url, ... }] }
    // We want the first HTTPS tunnel
    const tunnels = data.tunnels || [];
    const httpsTunnel = tunnels.find((t) => t.public_url && t.public_url.startsWith('https'));
    if (httpsTunnel) {
      return httpsTunnel.public_url.replace(/\/$/, ''); // strip trailing slash
    }
    // Fallback to any tunnel
    if (tunnels.length > 0 && tunnels[0].public_url) {
      return tunnels[0].public_url.replace(/\/$/, '');
    }
    return null;
  } catch {
    // ngrok not running or API not reachable
    return null;
  }
}

/**
 * Get the ngrok tunnel URL, using cache when fresh.
 * @returns {string|null}
 */
async function getNgrokUrl() {
  const now = Date.now();
  if (cachedUrl && (now - lastChecked) < POLL_INTERVAL_MS) {
    return cachedUrl;
  }

  const url = await fetchNgrokUrl();
  if (url !== cachedUrl) {
    if (url) {
      console.log(`[NgrokDetector] Tunnel detected: ${url}`);
    } else if (cachedUrl) {
      console.log('[NgrokDetector] Tunnel lost — ngrok may have been stopped');
    }
    cachedUrl = url;
  }
  lastChecked = now;
  return cachedUrl;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Get the full callback URL for M-Pesa.
 * Priority: manual override > ngrok auto-detect > MPESA_CALLBACK_URL env var
 *
 * @param {string} [path] - Path to append, e.g. '/api/payments/mpesa/callback'
 * @returns {Promise<string>}
 */
async function getCallbackUrl(path) {
  // 1. Manual override (set via admin endpoint)
  if (manualOverride) {
    const base = manualOverride.replace(/\/$/, '');
    return path ? `${base}${path}` : base;
  }

  // 2. Try ngrok auto-detection (only in sandbox mode)
  const env = (process.env.MPESA_ENV || 'sandbox').toLowerCase();
  if (env === 'sandbox') {
    const ngrokUrl = await getNgrokUrl();
    if (ngrokUrl) {
      const base = ngrokUrl.replace(/\/$/, '');
      return path ? `${base}${path}` : base;
    }
  }

  // 3. Fall back to env var
  const envUrl = process.env.MPESA_CALLBACK_URL || '';
  if (path && envUrl) {
    return `${envUrl.replace(/\/$/, '')}${path}`;
  }
  return envUrl;
}

/**
 * Get current status of the callback URL resolution.
 */
function getStatus() {
  return {
    ngrokRunning: !!cachedUrl,
    ngrokUrl: cachedUrl || null,
    manualOverride: manualOverride || null,
    envUrl: process.env.MPESA_CALLBACK_URL || null,
    mode: process.env.MPESA_ENV || 'sandbox',
    lastChecked: lastChecked ? new Date(lastChecked).toISOString() : null,
    source: manualOverride ? 'manual' : (cachedUrl ? 'ngrok' : 'env'),
  };
}

/**
 * Set a manual callback URL override (admin endpoint).
 * Pass null to clear and resume auto-detection.
 * @param {string|null} url
 */
function setManualOverride(url) {
  if (url) {
    manualOverride = url.replace(/\/$/, '');
    console.log(`[NgrokDetector] Manual override set: ${manualOverride}`);
  } else {
    console.log('[NgrokDetector] Manual override cleared — resuming auto-detection');
    manualOverride = null;
  }
}

/**
 * Force an immediate re-check of the ngrok tunnel.
 * @returns {Promise<string|null>}
 */
async function forceRefresh() {
  lastChecked = 0;
  return getNgrokUrl();
}

module.exports = {
  getCallbackUrl,
  getNgrokUrl,
  getStatus,
  setManualOverride,
  forceRefresh,
};
