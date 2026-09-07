// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
const axios = require('axios');
const { getCallbackUrl: resolveCallbackUrl } = require('../utils/ngrokDetector');
// Webhook signature is only for verifying incoming callbacks — NOT for the STK request URL
// Safaricom rejects callback URLs with query parameters

// ── FIX (Continuity Audit, Part Four — critical) ───────────────────────────
// Every Daraja call used to be hardcoded to sandbox.safaricom.co.ke, with no
// way to ever reach the production host regardless of which credentials were
// placed in .env. That meant real M-Pesa payments could never actually be
// collected. MPESA_ENV now controls which host is used, and it defaults to
// 'sandbox' — the safe default — so nothing changes for existing setups
// unless production is explicitly opted into.
const MPESA_ENV = (process.env.MPESA_ENV || 'sandbox').toLowerCase();
const MPESA_BASE_URL = MPESA_ENV === 'production'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke';

if (MPESA_ENV !== 'production' && MPESA_ENV !== 'sandbox') {
  console.warn(`[MPESA] Unrecognized MPESA_ENV="${process.env.MPESA_ENV}" — falling back to sandbox host for safety.`);
}
console.log(`[MPESA] Daraja host: ${MPESA_BASE_URL} (MPESA_ENV=${MPESA_ENV})`);

// ── Callback security: replay protection ─────────────────────────────────
// Store processed callback IDs to prevent duplicate processing
const processedCallbacks = new Map(); // checkoutRequestId → timestamp
const CALLBACK_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // Clean up every 10 minutes

// Periodic cleanup of old entries
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of processedCallbacks) {
    if (now - timestamp > CALLBACK_MAX_AGE_MS * 2) {
      processedCallbacks.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS);

/**
 * Check if a callback has already been processed (replay protection).
 * @param {string} checkoutRequestId
 * @returns {boolean} true if already processed
 */
function isCallbackProcessed(checkoutRequestId) {
  return processedCallbacks.has(checkoutRequestId);
}

/**
 * Mark a callback as processed.
 * @param {string} checkoutRequestId
 */
function markCallbackProcessed(checkoutRequestId) {
  processedCallbacks.set(checkoutRequestId, Date.now());
}

// Safaricom IP ranges for callback verification (these would need to be updated regularly)
// These are the known IP ranges that Safaricom uses for sending callbacks
const SAFARICOM_IP_RANGES = [
  // Safaricom Sandbox IPs
  '159.89.224.21', // Known sandbox callback IP
  '41.217.248.', // Safaricom IP range
  '105.29.', // Safaricom IP range
  // Production IPs (these are examples, actual ranges should be verified with Safaricom)
  '41.217.', // Safaricom production IP range
  '197.232.', // Safaricom production IP range
];

const formatPhone = (phone) => {
  const cleaned = String(phone || '').replace(/\D/g, '');
  if (cleaned.startsWith('254')) return cleaned;
  if (cleaned.startsWith('0')) return `254${cleaned.slice(1)}`;
  if (cleaned.length === 9) return `254${cleaned}`;
  return cleaned;
};

const validatePhone = (phone) => {
  const formatted = formatPhone(phone);
  return /^254[17]\d{8}$/.test(formatted) ? formatted : null;
};

const generateToken = async () => {
  const { MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET } = process.env;
  if (!MPESA_CONSUMER_KEY || !MPESA_CONSUMER_SECRET) {
    throw new Error('M-Pesa credentials not configured. Set MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET in backend/.env');
  }
  const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64');
  try {
    const { data } = await axios.get(
      `${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
      { headers: { Authorization: `Basic ${auth}` }, timeout: 10000 },
    );
    if (!data.access_token) throw new Error('Failed to obtain M-Pesa access token');
    return data.access_token;
  } catch (err) {
    // Surface the actual Safaricom error (e.g. "Wrong credentials")
    const status = err.response?.status;
    const body = err.response?.data;
    const detail = body?.errorMessage || body?.error || body?.message || err.message;
    const env = MPESA_ENV === 'production' ? 'PRODUCTION' : 'SANDBOX';
    if (status === 401 || status === 403) {
      throw new Error(`M-Pesa ${env} authentication failed: ${detail}. Check MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET match the ${env} credentials at https://developer.safaricom.co.ke`);
    }
    throw new Error(`M-Pesa token error (${env}): ${detail}`);
  }
};

const stkPush = async (phone, amount, accountRef, description) => {
  const { MPESA_SHORTCODE, MPESA_PASSKEY } = process.env;
  if (!MPESA_SHORTCODE || !MPESA_PASSKEY) {
    throw new Error('M-Pesa configuration incomplete (missing SHORTCODE or PASSKEY)');
  }

  const validPhone = validatePhone(phone);
  if (!validPhone) throw new Error(`Invalid phone number: ${phone}`);

  const parsedAmount = Math.ceil(Number(amount));
  if (!parsedAmount || parsedAmount < 1 || parsedAmount > 150000) {
    throw new Error(`Invalid amount: ${amount}`);
  }

  // Sanitize accountRef and description — alphanumeric + spaces only
  const safeRef = String(accountRef || 'PCL').replace(/[^A-Z0-9 ]/gi, '').slice(0, 12);
  const safeDesc = String(description || 'Payment').replace(/[^A-Z0-9 ]/gi, '').slice(0, 13);

  const token = await generateToken();
  const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
  const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString('base64');

  // Resolve callback URL dynamically: ngrok auto-detect > manual override > env var
  const callbackUrl = await resolveCallbackUrl('/api/payments/mpesa/callback');
  if (!callbackUrl) {
    throw new Error('No callback URL available. Set MPESA_CALLBACK_URL in .env or start ngrok');
  }

  const stkPayload = {
    BusinessShortCode: MPESA_SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: parsedAmount,
    PartyA: validPhone,
    PartyB: MPESA_SHORTCODE,
    PhoneNumber: validPhone,
    CallBackURL: callbackUrl,
    AccountReference: safeRef,
    TransactionDesc: safeDesc,
  };

  console.log(`[MPESA] STK Push request: phone=${validPhone}, amount=${parsedAmount}, shortcode=${MPESA_SHORTCODE}`);
  console.log(`[MPESA] Callback URL: ${callbackUrl} (auto-detected)`);

  let data;
  try {
    const response = await axios.post(
      `${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
      stkPayload,
      { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 },
    );
    data = response.data;
  } catch (apiErr) {
    // Safaricom returns 400 with error details in the response body
    const errData = apiErr.response?.data || {};
    console.error('[MPESA] STK Push API error:', JSON.stringify(errData));
    throw new Error(
      errData.errorMessage
        || errData.error?.errorMessage
        || `STK Push failed: ${apiErr.response?.status || apiErr.message}`,
    );
  }

  // Check for Safaricom-level errors in the response body
  if (data.ResponseCode && data.ResponseCode !== '0') {
    console.error('[MPESA] STK Push rejected:', JSON.stringify(data));
    throw new Error(data.ResponseDescription || `STK Push rejected with code ${data.ResponseCode}`);
  }

  if (data.CheckoutRequestID) {
    console.log(`[MPESA] STK Push initiated: ${data.CheckoutRequestID}`);
  } else {
    console.error('[MPESA] STK Push response missing CheckoutRequestID:', JSON.stringify(data));
  }

  return data;
};

const verifyMpesaSource = (req, res, next) => {
  try {
    // Get the client IP address (considering proxies)
    const clientIP = req.headers['x-forwarded-for']
                     || req.headers['x-real-ip']
                     || req.connection.remoteAddress
                     || req.socket.remoteAddress
                     || (req.connection.socket ? req.connection.socket.remoteAddress : null)
                     || '127.0.0.1';

    // Clean IP address (remove ::ffff: prefix if present)
    const cleanIP = clientIP.replace(/^::ffff:/, '');

    // Check if IP matches Safaricom ranges
    const isFromSafaricom = SAFARICOM_IP_RANGES.some((range) => cleanIP.startsWith(range)
      || cleanIP === range);

    // In production: block non-Safaricom IPs (strict security)
    if (process.env.NODE_ENV === 'production' && !isFromSafaricom) {
      console.error(`[MPESA] REJECTED callback from non-Safaricom IP: ${cleanIP}`);
      return res.status(403).json({ message: 'Forbidden' });
    }

    // In development: warn but allow (for testing with ngrok/tunnels)
    if (process.env.NODE_ENV !== 'production' && !isFromSafaricom) {
      console.warn(`[MPESA] Callback from non-Safaricom IP: ${cleanIP} (allowed in dev)`);
    }

    // Add IP information to request for logging/debugging
    req.mpesaSourceInfo = { clientIP: cleanIP, isFromSafaricom };

    next();
  } catch (error) {
    console.error('Error verifying M-Pesa source:', error.message);
    // Don't block the request if verification fails, just continue
    next();
  }
};

const validateCallback = (body) => {
  // Basic structure validation
  const result = body?.Body?.stkCallback;
  if (!result) throw new Error('Invalid callback body structure');

  // Extract essential fields
  const {
    ResultCode,
    CheckoutRequestID,
    CallbackMetadata,
    MerchantRequestID,
  } = result;

  // Validate required fields exist
  if (!CheckoutRequestID) throw new Error('Missing CheckoutRequestID in callback');
  if (!MerchantRequestID) throw new Error('Missing MerchantRequestID in callback');
  if (typeof ResultCode === 'undefined') throw new Error('Missing ResultCode in callback');

  // Initialize metadata object
  const meta = {};

  // Process callback metadata if successful
  if (ResultCode === 0 && CallbackMetadata) {
    if (!Array.isArray(CallbackMetadata.Item)) {
      throw new Error('Invalid CallbackMetadata structure');
    }

    // Process each metadata item safely
    CallbackMetadata.Item.forEach((item) => {
      if (item && typeof item === 'object' && item.Name && item.Value !== undefined) {
        meta[item.Name] = item.Value;
      }
    });
  }

  // Validate the required payment details if transaction was successful
  if (ResultCode === 0) {
    // Verify required payment details are present
    if (!meta.MpesaReceiptNumber) throw new Error('Missing MpesaReceiptNumber in callback');
    if (!meta.TransactionDate) throw new Error('Missing TransactionDate in callback');
    if (!meta.PhoneNumber) throw new Error('Missing PhoneNumber in callback');

    // Validate amount if present
    if (meta.Amount) {
      const amount = Number(meta.Amount);
      if (Number.isNaN(amount) || amount <= 0) {
        throw new Error('Invalid amount in callback');
      }
    }
  }

  const success = ResultCode === 0;
  const amount = Number(meta.Amount || 0);
  const mpesaRef = String(meta.MpesaReceiptNumber || '');
  const phone = String(meta.PhoneNumber || '');

  return {
    success,
    resultCode: ResultCode,
    checkoutRequestId: CheckoutRequestID,
    merchantRequestId: MerchantRequestID,
    amount,
    mpesaRef,
    phone,
    meta,
  };
};

module.exports = {
  stkPush,
  validateCallback,
  formatPhone,
  verifyMpesaSource,
  isCallbackProcessed,
  markCallbackProcessed,
  CALLBACK_MAX_AGE_MS,
};
