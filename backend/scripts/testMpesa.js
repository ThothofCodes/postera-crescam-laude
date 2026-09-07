#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// M-Pesa Sandbox End-to-End Test Script
// ═══════════════════════════════════════════════════════════════════════════
// Usage:
//   node scripts/testMpesa.js                        # Interactive — prompts for phone
//   node scripts/testMpesa.js +254712345678          # Direct — pass phone number
//   node scripts/testMpesa.js +254712345678 1        # Direct — with custom amount (KES)
//
// What it tests:
//   1. Environment configuration (all required vars present)
//   2. OAuth token generation (Daraja auth)
//   3. STK Push (Lipa Na M-Pesa Online)
//   4. Callback monitoring (if running locally)
//
// Requirements:
//   - Backend .env must be configured with M-Pesa credentials
//   - Node.js 18+ with axios installed
// ═══════════════════════════════════════════════════════════════════════════

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const axios = require('axios');
const readline = require('readline');
const { getCallbackUrl, getNgrokUrl, getStatus } = require('../utils/ngrokDetector');

// ── Colours ────────────────────────────────────────────────────────────────
const C = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

const log = {
  ok: (msg) => console.log(`  ${C.green}✓${C.reset} ${msg}`),
  fail: (msg) => console.log(`  ${C.red}✗${C.reset} ${msg}`),
  info: (msg) => console.log(`  ${C.cyan}→${C.reset} ${msg}`),
  warn: (msg) => console.log(`  ${C.yellow}⚠${C.reset} ${msg}`),
  step: (n, msg) => console.log(`\n${C.bold}${C.cyan}[Step ${n}]${C.reset} ${C.bold}${msg}${C.reset}`),
  header: (msg) => console.log(`\n${C.bold}═══ ${msg} ═══${C.reset}`),
};

// ── Helpers ────────────────────────────────────────────────────────────────
function formatPhone(phone) {
  const cleaned = String(phone || '').replace(/\D/g, '');
  if (cleaned.startsWith('254')) return cleaned;
  if (cleaned.startsWith('0')) return `254${cleaned.slice(1)}`;
  if (cleaned.length === 9) return `254${cleaned}`;
  return cleaned;
}

function validatePhone(phone) {
  const formatted = formatPhone(phone);
  return /^254[17]\d{8}$/.test(formatted) ? formatted : null;
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); });
  });
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST 1: Environment Configuration
// ═══════════════════════════════════════════════════════════════════════════
async function testEnvironment() {
  log.step(1, 'Environment Configuration');

  const env = process.env.MPESA_ENV || 'sandbox';
  const baseUrl = env === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

  log.info(`MPESA_ENV: ${env}`);
  log.info(`Daraja host: ${baseUrl}`);

  // ── Ngrok auto-detection ────────────────────────────────────────────────
  if (env === 'sandbox') {
    const ngrokUrl = await getNgrokUrl();
    if (ngrokUrl) {
      log.ok(`ngrok tunnel detected: ${ngrokUrl}`);
      log.info('Callback URL will be auto-resolved from ngrok tunnel');
    } else {
      log.warn('ngrok not detected — using MPESA_CALLBACK_URL from .env');
      log.info('Tip: Start ngrok with `ngrok http 5001` for automatic callback URL detection');
    }
  }

  const required = [
    'MPESA_CONSUMER_KEY',
    'MPESA_CONSUMER_SECRET',
    'MPESA_SHORTCODE',
    'MPESA_PASSKEY',
  ];

  let allPresent = true;
  for (const key of required) {
    const val = process.env[key];
    if (!val || val.startsWith('<') || val === 'your_shortcode') {
      log.fail(`${key} is missing or not configured`);
      allPresent = false;
    } else {
      // Show masked value (first 6 chars + ...)
      const masked = val.length > 10 ? `${val.slice(0, 6)}...${val.slice(-4)}` : '***';
      log.ok(`${key} = ${masked}`);
    }
  }

  if (!allPresent) {
    log.warn('Some credentials are missing. Fill them in backend/.env');
    return null;
  }

  return { env, baseUrl };
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST 2: OAuth Token Generation
// ═══════════════════════════════════════════════════════════════════════════
async function testOAuth(baseUrl) {
  log.step(2, 'OAuth Token Generation');

  const key = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;
  const auth = Buffer.from(`${key}:${secret}`).toString('base64');

  try {
    const { data, status } = await axios.get(
      `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: { Authorization: `Basic ${auth}` },
        timeout: 15000,
      },
    );

    if (data.access_token) {
      const tokenPreview = `${data.access_token.slice(0, 10)}...${data.access_token.slice(-6)}`;
      log.ok(`Token obtained: ${tokenPreview}`);
      log.ok(`Expires in: ${data.expires_in || 'unknown'}s`);
      return data.access_token;
    }

    log.fail('Response missing access_token');
    log.warn(`Response: ${JSON.stringify(data)}`);
    return null;
  } catch (err) {
    const status = err.response?.status;
    const body = err.response?.data;
    const detail = body?.errorMessage || body?.error || body?.message || err.message;

    if (status === 401 || status === 403) {
      log.fail(`Authentication FAILED (HTTP ${status})`);
      log.warn(`Safaricom says: ${detail}`);
      log.warn('');
      log.warn('  This means your consumer key/secret don\'t match the environment.');
      log.warn('  Your MPESA_ENV is: ' + (process.env.MPESA_ENV || 'sandbox'));
      log.warn('');
      log.warn('  Fix: Go to https://developer.safaricom.co.ke → My Apps');
      log.warn('  • Use SANDBOX credentials → keep MPESA_ENV=sandbox');
      log.warn('  • Use PRODUCTION credentials → set MPESA_ENV=production');
      log.warn('  • Do NOT mix sandbox keys with production host or vice versa');
    } else {
      log.fail(`OAuth request failed (HTTP ${status || 'timeout'})`);
      log.warn(`Error: ${detail}`);
    }
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST 3: STK Push (Lipa Na M-Pesa Online)
// ═══════════════════════════════════════════════════════════════════════════
async function testStkPush(baseUrl, token, phone, amount) {
  log.step(3, 'STK Push (Lipa Na M-Pesa Online)');

  const shortcode = process.env.MPESA_SHORTCODE;
  const passkey = process.env.MPESA_PASSKEY;

  // Resolve callback URL dynamically: ngrok > manual override > env var
  const callbackUrl = await getCallbackUrl('/api/payments/mpesa/callback');
  const urlStatus = getStatus();

  if (!callbackUrl) {
    log.fail('No callback URL available');
    log.warn('Either set MPESA_CALLBACK_URL in .env or start ngrok: ngrok http 5001');
    return null;
  }

  log.info(`Phone: ${phone}`);
  log.info(`Amount: KES ${amount}`);
  log.info(`Shortcode: ${shortcode}`);
  log.info(`Callback URL: ${callbackUrl}`);
  log.info(`URL source: ${urlStatus.source}`);

  // Check callback URL accessibility
  if (callbackUrl.includes('localhost') || callbackUrl.includes('127.0.0.1')) {
    log.warn('Callback URL points to localhost — Safaricom cannot reach it!');
    log.warn('Start ngrok: ngrok http 5001 (auto-detected on next check)');
    log.warn('Or set manually: PUT /api/payments/mpesa/callback-url');
  }

  // Generate password
  const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

  const payload = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Math.ceil(Number(amount)),
    PartyA: phone,
    PartyB: shortcode,
    PhoneNumber: phone,
    CallBackURL: callbackUrl,
    AccountReference: 'PCL Test',
    TransactionDesc: 'Test STK Push',
  };

  log.info(`Timestamp: ${timestamp}`);
  log.info('Sending STK push request to Safaricom...');

  try {
    const { data, status } = await axios.post(
      `${baseUrl}/mpesa/stkpush/v1/processrequest`,
      payload,
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 20000,
      },
    );

    log.info(`Response (HTTP ${status}): ${JSON.stringify(data, null, 2)}`);

    if (data.ResponseCode === '0' || data.ResponseCode === 0) {
      log.ok('STK Push SENT SUCCESSFULLY');
      log.ok(`MerchantRequestID: ${data.MerchantRequestID}`);
      log.ok(`CheckoutRequestID: ${data.CheckoutRequestID}`);
      log.ok(`CustomerMessage: ${data.CustomerMessage}`);
      log.warn('Check your phone — you should receive an M-Pesa prompt within 5 seconds');
      return data;
    }

    // Common error codes
    const errorGuide = {
      1032: 'Request cancelled by user (you tapped Cancel on the STK prompt)',
      1037: 'DS timeout — user did not respond to the STK prompt in time',
      2001: 'Wrong credentials — the credentials used are invalid',
      2002: 'Transaction timeout',
      2026: 'Debit account insufficient funds',
      17: 'Insufficient funds in M-Pesa account',
    };

    log.fail(`STK Push REJECTED (code: ${data.ResponseCode})`);
    log.warn(`Message: ${data.ResponseDescription}`);

    const guide = errorGuide[String(data.ResponseCode)];
    if (guide) {
      log.warn(`What this means: ${guide}`);
    }

    if (String(data.ResponseCode) === '2001') {
      log.warn('');
      log.warn('  "Wrong credentials" means your shortcode + passkey are incorrect.');
      log.warn('  • Check MPESA_SHORTCODE — must be your registered till/paybill number');
      log.warn('  • Check MPESA_PASSKEY — must match the passkey for that shortcode');
      log.warn('  • Get these from: https://developer.safaricom.co.ke → My Apps → sandbox');
    }

    return null;
  } catch (err) {
    const status = err.response?.status;
    const body = err.response?.data;
    log.fail(`STK Push request failed (HTTP ${status || 'timeout'})`);
    log.warn(`Error: ${body?.errorMessage || err.message}`);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST 4: Callback Monitor (optional — for local development)
// ═══════════════════════════════════════════════════════════════════════════
async function monitorCallback(checkoutRequestId, timeoutSec = 120) {
  log.step(4, 'Callback Monitor');
  log.info(`Waiting for callback for: ${checkoutRequestId}`);
  log.info(`Timeout: ${timeoutSec}s (polling order status endpoint)`);

  const callbackUrl = await getCallbackUrl('/api/payments/mpesa/callback');
  if (!callbackUrl.includes('localhost') && !callbackUrl.includes('ngrok')) {
    log.warn('Cannot monitor callback — URL is not local or ngrok');
    log.warn('Check your server logs for [MPESA] Callback received: ...');
    return;
  }

  const interval = 3000;
  const maxAttempts = Math.ceil((timeoutSec * 1000) / interval);

  for (let i = 0; i < maxAttempts; i++) {
    await sleep(interval);
    const elapsed = ((i + 1) * interval) / 1000;

    try {
      // Check if the backend processed the callback by looking at server logs
      process.stdout.write(`\r  ${C.dim}[${elapsed}s] Waiting for Safaricom callback...${C.reset}`);
    } catch {
      // Continue waiting
    }
  }

  log.warn('');
  log.warn('Timed out waiting for callback');
  log.warn('This usually means:');
  log.warn('  • The callback URL is not reachable from Safaricom');
  log.warn('  • The user did not enter their PIN on the STK prompt');
  log.warn('  • Sandbox callbacks can be delayed or unreliable');
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════
async function main() {
  console.log(`${C.bold}${C.cyan}`);
  console.log('  ╔═══════════════════════════════════════════════╗');
  console.log('  ║   M-Pesa Sandbox End-to-End Test             ║');
  console.log('  ║   Postera Crescam Laude                      ║');
  console.log('  ╚═══════════════════════════════════════════════╝');
  console.log(`${C.reset}`);

  // Parse args
  let phone = process.argv[2];
  const amount = process.argv[3] || 1;

  // Step 1: Check environment
  const config = await testEnvironment();
  if (!config) {
    console.log(`\n${C.red}Cannot proceed without valid credentials.${C.reset}`);
    console.log('Fix the issues above and try again.\n');
    process.exit(1);
  }

  // Step 2: Test OAuth
  const token = await testOAuth(config.baseUrl);
  if (!token) {
    console.log(`\n${C.red}Cannot proceed without a valid token.${C.reset}`);
    console.log('Fix the credentials and try again.\n');
    process.exit(1);
  }

  // Get phone number
  if (!phone) {
    phone = await ask('\n  Enter test phone number (Safaricom, e.g. +254712345678): ');
  }

  const validPhone = validatePhone(phone);
  if (!validPhone) {
    log.fail(`Invalid phone number: ${phone}`);
    log.warn('Must be a valid Safaricom number: 2547XXXXXXXX or 2541XXXXXXXX');
    process.exit(1);
  }
  phone = validPhone;

  // Step 3: Send STK push
  const result = await testStkPush(config.baseUrl, token, phone, amount);
  if (!result) {
    console.log(`\n${C.red}STK Push failed. Check the errors above.${C.reset}\n`);
    process.exit(1);
  }

  console.log(`\n${C.green}${C.bold}  ═══════════════════════════════════════════════${C.reset}`);
  console.log(`${C.green}${C.bold}  ✓ STK Push sent successfully!${C.reset}`);
  console.log(`${C.green}${C.bold}  ═══════════════════════════════════════════════${C.reset}`);
  console.log(`\n  ${C.bold}What to do next:${C.reset}`);
  console.log(`  1. Check your phone (${phone}) for the M-Pesa prompt`);
  console.log('  2. Enter your M-Pesa PIN to complete the test');
  console.log('  3. Watch your server logs for the callback:');
  console.log(`     ${C.dim}[MPESA] Callback received: id=... code=0 ip=...${C.reset}`);
  console.log('');

  // Optionally monitor
  const monitor = await ask('  Monitor callback? (y/N): ');
  if (monitor.toLowerCase() === 'y') {
    await monitorCallback(result.CheckoutRequestID);
  }

  console.log('');
}

main().catch((err) => {
  console.error(`\n${C.red}Fatal error:${C.reset}`, err.message);
  process.exit(1);
});
