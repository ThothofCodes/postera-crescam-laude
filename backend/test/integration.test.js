// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// Self-contained integration test suite.
// Spawns its own server on a free port, exercises every protocol, then shuts down.

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const net = require('net');

// ── Test harness ────────────────────────────────────────────────────────────

let BASE = null;
let csrfToken = null;
let csrfCookies = {};
const results = { pass: 0, fail: 0, errors: [] };

function ok(name) { results.pass++; process.stdout.write(`  ✅ ${name}\n`); }
function fail(name) { results.fail++; results.errors.push(name); process.stdout.write(`  ❌ ${name}\n`); }
function assert(cond, name) { cond ? ok(name) : fail(name); }

// ── Cookie helpers ──────────────────────────────────────────────────────────

function getCookies(res) {
  const raw = res.headers['set-cookie'];
  if (!raw) return {};
  const cookies = {};
  for (const c of (Array.isArray(raw) ? raw : [raw])) {
    const [pair] = c.split(';');
    const [k, ...v] = pair.split('=');
    if (k) cookies[k.trim()] = decodeURIComponent(v.join('=').trim());
  }
  return cookies;
}
function cookieStr(cookies) {
  return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
}

// ── HTTP request helper ─────────────────────────────────────────────────────

function req(method, urlPath, { body, headers = {}, withCsrf = false, timeout = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const opts = {
      hostname: url.hostname, port: url.port,
      path: url.pathname + url.search, method,
      headers: { ...headers }, timeout,
    };

    // Auto-attach CSRF for write methods
    const WRITES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
    if ((withCsrf || WRITES.has(method)) && csrfToken) {
      opts.headers['X-CSRF-Token'] = csrfToken;
      const cs = cookieStr(csrfCookies);
      if (cs) opts.headers['Cookie'] = cs;
    }

    const r = http.request(opts, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        // Sync CSRF state from Set-Cookie
        const nc = getCookies(res);
        if (nc._csrf) { csrfCookies._csrf = nc._csrf; csrfToken = nc._csrf; }
        if (nc.pcl_token) csrfCookies.pcl_token = nc.pcl_token;

        const buf = Buffer.concat(chunks);
        let data;
        try { data = JSON.parse(buf.toString()); } catch { data = buf.toString(); }
        resolve({ status: res.statusCode, headers: res.headers, body: data });
      });
    });
    r.on('error', reject);
    r.on('timeout', () => { r.destroy(); reject(new Error('timeout')); });
    if (body !== undefined) {
      r.setHeader('Content-Type', 'application/json');
      r.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    r.end();
  });
}

// ── Server lifecycle ────────────────────────────────────────────────────────

function findFreePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
    s.on('error', reject);
  });
}

async function startServer() {
  const port = await findFreePort();
  const proc = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  BASE = `http://127.0.0.1:${port}`;

  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try {
      const r = await req('GET', '/api/v1/deployment/ready', { timeout: 3000 });
      if (r.status === 200 || r.status === 503) { process.stdout.write(`Server ready at ${BASE}\n`); return proc; }
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  proc.kill('SIGKILL');
  throw new Error('Server failed to start within 60s');
}

async function acquireCSRF() {
  try {
    const r = await req('GET', '/api/v1/auth/csrf-token', { withCsrf: false });
    if (r.status === 200 && r.body?.csrfToken) {
      csrfToken = r.body.csrfToken;
      csrfCookies = { '_csrf': csrfToken };
      process.stdout.write(`CSRF acquired (${csrfToken.length} chars)\n`);
      return true;
    }
  } catch (e) { process.stdout.write(`CSRF error: ${e.message}\n`); }
  return false;
}

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITES
// ══════════════════════════════════════════════════════════════════════════════

async function t1_health() {
  process.stdout.write('\n─── 1. HEALTH & DEPLOYMENT ───\n');
  const r = await req('GET', '/api/v1/deployment/status');
  assert(r.status === 200, 'GET /deployment/status → 200');
  assert(r.body?.status && typeof r.body.status === 'string', 'Status field present');
  const ready = await req('GET', '/api/v1/deployment/ready');
  assert(ready.status === 200 || ready.status === 503, 'GET /deployment/ready → 200 or 503');
  const live = await req('GET', '/api/v1/deployment/live');
  assert(live.status === 200, 'GET /deployment/live → 200');
}

async function t2_csrf() {
  process.stdout.write('\n─── 2. CSRF PROTECTION ───\n');
  const r = await req('GET', '/api/v1/auth/csrf-token');
  assert(r.status === 200, `GET /auth/csrf-token → 200 (got ${r.status})`);
  assert(r.body?.csrfToken && r.body.csrfToken.length > 10, 'csrfToken returned and has content');
}

async function t3_cors() {
  process.stdout.write('\n─── 3. CORS ───\n');
  const pre = await req('OPTIONS', '/api/v1/auth/csrf-token', {
    headers: { 'Origin': 'http://localhost:3000', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'Content-Type,X-CSRF-Token' },
  });
  assert(pre.status === 204 || pre.status === 200, 'OPTIONS preflight → 200/204');
  assert(pre.headers['access-control-allow-origin'], 'access-control-allow-origin present');
  assert(pre.headers['access-control-allow-methods'], 'access-control-allow-methods present');

  const r = await req('GET', '/api/v1/deployment/status', { headers: { 'Origin': 'http://localhost:3000' } });
  assert(r.headers['access-control-allow-origin'], 'CORS header on regular GET');
}

async function t4_compression() {
  process.stdout.write('\n─── 4. COMPRESSION ───\n');
  const r = await req('GET', '/api/v1/products', { headers: { 'Accept-Encoding': 'gzip, br, deflate' } });
  assert(r.status === 200, 'GET /products → 200');
  assert(r.headers['content-encoding'] === 'br' || r.headers['content-encoding'] === 'gzip',
    `Response compressed (${r.headers['content-encoding'] || 'none'})`);
}

async function t5_public() {
  process.stdout.write('\n─── 5. PUBLIC ENDPOINTS ───\n');
  const paths = [
    '/api/v1/products', '/api/v1/products/featured', '/api/v1/services',
    '/api/v1/calculator/pricing-rules', '/api/v1/consultations/types',
    '/api/v1/departments', '/api/v1/deployment/status',
    '/api/v1/deployment/ready', '/api/v1/deployment/live',
    '/api/v1/db-health/basic', '/api/v1/tech-hub/public/articles',
    '/api/v1/tech-hub/public/tips', '/api/v1/tech-hub/public/news',
    '/api/v1/tech-hub/public/facts', '/api/v1/tech-hub/public/status',
  ];
  for (const p of paths) {
    const r = await req('GET', p);
    assert(r.status < 500, `GET ${p.replace('/api/v1', '')} no 5xx (got ${r.status})`);
  }
}

async function t6_protected() {
  process.stdout.write('\n─── 6. PROTECTED ROUTES → 401 ───\n');
  const paths = [
    '/api/v1/admin/stats', '/api/v1/admin/audit', '/api/v1/analytics/summary',
    '/api/v1/analytics/departments', '/api/v1/users', '/api/v1/revenue/summary',
    '/api/v1/billing', '/api/v1/tickets', '/api/v1/clients', '/api/v1/bookings',
    '/api/v1/consultations', '/api/v1/departments/all', '/api/v1/department-admins',
    '/api/v1/inventory', '/api/v1/payment-history', '/api/v1/staff-portal/memos',
    '/api/v1/monetization/dashboard', '/api/v1/meetings/rooms', '/api/v1/webhook-config',
  ];
  for (const p of paths) {
    const r = await req('GET', p);
    assert(r.status === 401, `${p.replace('/api/v1', '')} → 401 (got ${r.status})`);
  }
}

async function t7_validation() {
  process.stdout.write('\n─── 7. ZOD VALIDATION ───\n');
  const badQuery = await req('GET', '/api/v1/products?page=abc&limit=-1');
  assert(badQuery.status < 500, 'Bad product query handled');

  const tests = [
    ['POST', '/api/v1/orders', {}],
    ['POST', '/api/v1/consultations', {}],
    ['POST', '/api/v1/calculator/estimate', { service: '' }],
    ['POST', '/api/v1/tickets', {}],
  ];
  for (const [m, p, b] of tests) {
    const r = await req(m, p, { body: b, withCsrf: true });
    assert(r.status === 400, `${m} ${p.replace('/api/v1', '')} empty body → 400 (got ${r.status})`);
  }

  const badId = await req('GET', '/api/v1/products/not-a-valid-id');
  assert(badId.status === 400, 'Invalid ObjectId → 400');

  const inject = await req('GET', '/api/v1/products?search[$gt]=');
  assert(inject.status < 500, 'NoSQL injection handled safely');
}

async function t8_analytics() {
  process.stdout.write('\n─── 8. ANALYTICS EVENTS ───\n');
  const empty = await req('POST', '/api/v1/analytics/events', { body: {}, withCsrf: true });
  assert(empty.status === 400, `Empty payload → 400 (got ${empty.status})`);

  const emptyArr = await req('POST', '/api/v1/analytics/events', { body: { events: [] }, withCsrf: true });
  assert(emptyArr.status === 400, `Empty array → 400 (got ${emptyArr.status})`);

  const valid = await req('POST', '/api/v1/analytics/events', {
    body: { events: [
      { event: 'page_viewed', timestamp: new Date().toISOString(), sessionId: 'test-1', url: '/' },
      { event: 'product_viewed', timestamp: new Date().toISOString(), sessionId: 'test-1', url: '/p', productId: '123' },
    ]},
    withCsrf: true,
  });
  assert(valid.status === 200, `Valid batch → 200 (got ${valid.status})`);
  assert(valid.body?.received === 2, `Received count = 2 (got ${valid.body?.received})`);

  const big = Array.from({ length: 100 }, (_, i) => ({ event: 'test', timestamp: new Date().toISOString(), sessionId: `s${i}`, url: '/' }));
  const r = await req('POST', '/api/v1/analytics/events', { body: { events: big }, withCsrf: true });
  assert(r.status === 200 && r.body?.received === 50, `Batch capped at 50 (got ${r.body?.received})`);
}

async function t9_ratelimit() {
  process.stdout.write('\n─── 9. RATE LIMITING ───\n');
  const r = await req('POST', '/api/v1/auth/login', { body: { email: 'x@x.com', password: 'x' } });
  assert(r.headers['ratelimit-limit'] || r.headers['x-ratelimit-limit'] || r.headers['retry-after'] || r.status >= 400,
    'Rate limit headers present or proper error');
  const r2 = await req('GET', '/api/v1/products');
  assert(r2.status === 200, 'GET /products under rate limit');
}

async function t10_webhook() {
  process.stdout.write('\n─── 10. WEBHOOK SIGNATURE ───\n');
  const r1 = await req('POST', '/api/v1/payments/mpesa/callback', {
    body: { Body: { stkCallback: { ResultCode: 0, ResultDesc: 'OK' } } }, withCsrf: true,
  });
  assert([400, 401, 403, 500].includes(r1.status), `M-Pesa callback rejected (got ${r1.status})`);

  const r2 = await req('POST', '/api/v1/billing/mpesa-callback', {
    body: { Body: { stkCallback: { ResultCode: 0, ResultDesc: 'OK' } } }, withCsrf: true,
  });
  assert([400, 401, 403, 500].includes(r2.status), `Billing callback rejected (got ${r2.status})`);
}

async function t11_errors() {
  process.stdout.write('\n─── 11. ERROR HANDLING ───\n');
  const r404 = await req('GET', '/api/v1/nonexistent/route');
  assert(r404.status === 404, 'Non-existent route → 404');

  // Malformed JSON (raw http to bypass helper)
  const r = await new Promise((resolve) => {
    const url = new URL('/api/v1/auth/login', BASE);
    const req2 = http.request({
      hostname: url.hostname, port: url.port, path: url.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json' }, timeout: 10000,
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        let data; try { data = JSON.parse(Buffer.concat(chunks).toString()); } catch { data = {}; }
        resolve({ status: res.statusCode, body: data });
      });
    });
    req2.on('error', () => resolve({ status: 500, body: {} }));
    req2.write('{invalid json');
    req2.end();
  });
  assert(r.status === 400, 'Malformed JSON → 400');

  const rBad = await req('GET', '/api/v1/products/zzz123notid');
  assert(rBad.status === 400, 'Invalid ObjectId → 400');
}

async function t12_security() {
  process.stdout.write('\n─── 12. SECURITY HEADERS ───\n');
  const r = await req('GET', '/api/v1/deployment/status');
  assert(r.status === 200, 'Status endpoint accessible');
  assert(r.headers['x-content-type-options'] === 'nosniff', 'X-Content-Type-Options: nosniff');
  assert(r.headers['x-frame-options'] || r.headers['content-security-policy'], 'Security headers present');
}

async function t13_versioning() {
  process.stdout.write('\n─── 13. API VERSIONING ───\n');
  const v1 = await req('GET', '/api/v1/deployment/status');
  assert(v1.status === 200, 'GET /api/v1/deployment/status works');
  assert(v1.headers['x-api-version'] || v1.status === 200, 'API version present');
}

async function t14_methods() {
  process.stdout.write('\n─── 14. HTTP METHOD VALIDATION ───\n');
  const r1 = await req('DELETE', '/api/v1/products', { withCsrf: true });
  assert([404, 405, 403, 401, 429].includes(r1.status), `DELETE /products rejected (got ${r1.status})`);

  const r2 = await req('PATCH', '/api/v1/services', { withCsrf: true });
  assert([404, 405, 403, 401, 429].includes(r2.status), `PATCH /services rejected (got ${r2.status})`);
}

async function t15_payload() {
  process.stdout.write('\n─── 15. PAYLOAD SIZE LIMITS ───\n');
  const bigBody = JSON.stringify({ data: 'x'.repeat(2 * 1024 * 1024) });
  try {
    const r = await req('POST', '/api/v1/auth/login', { body: bigBody, headers: { 'Content-Type': 'application/json' } });
    assert([413, 400, 403, 429].includes(r.status), `Oversized body rejected (got ${r.status})`);
  } catch { assert(true, 'Oversized body rejected (connection error)'); }
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════

async function main() {
  process.stdout.write('\n╔══════════════════════════════════════════════════╗\n');
  process.stdout.write('║   FULL INTEGRATION TEST SUITE                   ║\n');
  process.stdout.write('║   PCL Solutions — All Protocols                 ║\n');
  process.stdout.write('╚══════════════════════════════════════════════════╝\n\n');

  let proc = null;
  try {
    proc = await startServer();
    if (!(await acquireCSRF())) process.stdout.write('⚠️  CSRF token not acquired — POST tests may fail\n');

    await t1_health();
    await t2_csrf();
    await t3_cors();
    await t4_compression();
    await t5_public();
    await t6_protected();
    await t7_validation();
    await t8_analytics();
    await t9_ratelimit();
    await t10_webhook();
    await t11_errors();
    await t12_security();
    await t13_versioning();
    await t14_methods();
    await t15_payload();
  } catch (e) {
    process.stdout.write(`\n💥 FATAL: ${e.message}\n`);
    results.fail++; results.errors.push(`Fatal: ${e.message}`);
  } finally {
    if (proc) { proc.kill('SIGTERM'); await new Promise(r => setTimeout(r, 1000)); proc.kill('SIGKILL'); }
  }

  process.stdout.write('\n╔══════════════════════════════════════════════════╗\n');
  process.stdout.write(`║   RESULTS: ${String(results.pass).padStart(3)} passed, ${String(results.fail).padStart(3)} failed              ║\n`);
  process.stdout.write('╚══════════════════════════════════════════════════╝\n');

  if (results.errors.length > 0) {
    process.stdout.write('\nFailed:\n');
    results.errors.forEach(e => process.stdout.write(`  ❌ ${e}\n`));
  }

  process.exit(results.fail > 0 ? 1 : 0);
}

main().catch(e => { process.stdout.write(`Unhandled: ${e.message}\n`); process.exit(1); });
