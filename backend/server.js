// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const mongoose = require('mongoose');
const http = require('http');
const swaggerUi = require('swagger-ui-express');
const path = require('path');
const {
  globalLimiter, writeLimiter, authLimiter, heavyLimiter, webhookLimiter,
} = require('./middleware/rateLimiter');
const connectDB = require('./config/db');
const setupIndexes = require('./utils/setupIndexes');
const requestId = require('./middleware/requestId');
const requestLogger = require('./middleware/requestLogger');
const logger = require('./utils/logger');
const { metrics, metricsMiddleware } = require('./utils/metrics');
const { swaggerSpec } = require('./swagger');
const { csrfProtection } = require('./middleware/csrf');
const { versionHeaders, legacyAlias } = require('./middleware/apiVersion');
const { brotliCompression, gzipFallback } = require('./middleware/compression');
const { getClient: getRedisClient, isConnected: isRedisConnected, disconnect: disconnectRedis } = require('./config/redis');

mongoose.set('bufferCommands', false);

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', {
    message: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception — shutting down', {
    message: err.message,
    stack: err.stack,
  });
  // Give pending I/O to flush, then exit
  setTimeout(() => process.exit(1), 1000);
});

let dbReady = false;

// Log connection state changes
mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected — will attempt auto-reconnect');
  dbReady = false;
});
mongoose.connection.on('connected', () => {
  logger.info('MongoDB connected');
  dbReady = true;
});
mongoose.connection.on('error', (err) => {
  logger.error('MongoDB connection error', { message: err.message });
});

const app = express();
app.set('trust proxy', 1);

// ── 1. Security headers (Helmet) ────────────────────────────────────────────
// connectSrc was hardcoded to the sandbox Safaricom host only — harmless
// while MPESA_ENV=sandbox, but it would silently block the browser from ever
// reaching the production host if the frontend needs to talk to it directly.
// Mirrors the same MPESA_ENV switch used in middleware/mpesa.js.
const MPESA_CSP_HOST = (process.env.MPESA_ENV || 'sandbox').toLowerCase() === 'production'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:', 'http:', 'https:'],
      connectSrc: ["'self'", 'ws:', 'wss:', 'http:', 'https:', MPESA_CSP_HOST],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permissionsPolicy: {
    camera: [],
    microphone: [],
    geolocation: [],
    interestCohort: [],
  },
}));

// ── 2. CORS — origin whitelist with mobile/LAN/tunnel support ───────────────
const isDev = process.env.NODE_ENV !== 'production';
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl, Postman, server-to-server)
    if (!origin) return cb(null, true);
    // In development, allow localhost and LAN origins only
    if (isDev && /^https?:\/\/localhost(:\d+)?$/.test(origin)) return cb(null, true);
    if (isDev && /^https?:\/\/\d+\.\d+\.\d+\.\d+(:\d+)?$/.test(origin)) return cb(null, true);
    // In development, allow known tunnel domains (ngrok, localtunnel)
    if (isDev && /^https?:\/\/[\w.-]+\.ngrok\.io(:\d+)?$/.test(origin)) return cb(null, true);
    if (isDev && /^https?:\/\/[\w-]+\.loca\.lt(:\d+)?$/.test(origin)) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    logger.warn(`CORS blocked: origin ${origin} not in whitelist`);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
}));

// ── 3. Body size limits — prevent large payload DoS ────────────────────────
app.use(express.json({ limit: '5mb' })); // Increased for Tech Hub article body content
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ── 3c. Response compression — brotli (preferred) + gzip fallback ───────────
// Must come after body parsers (to have Content-Type set) and before routes.
app.use(brotliCompression);
app.use(gzipFallback);

// ── 3b. CSRF protection — validates X-CSRF-Token header on mutations ──
app.use(csrfProtection);

// ── 3a. MinIO object storage init + proxy ────────────────────────────────
const { ensureBuckets, getClient, MINIO_BUCKET } = require('./config/cloudinary');

// Ensure MinIO buckets exist at startup
ensureBuckets().catch((e) => logger.warn('MinIO bucket init warning', { message: e.message }));

// Proxy /uploads/* to MinIO — maintains backward-compatible URLs
app.use('/uploads', async (req, res) => {
  try {
    const client = getClient();
    const objectName = decodeURIComponent(req.path.replace(/^\//, ''));
    if (!objectName) return res.status(404).json({ message: 'No file specified' });

    const stat = await client.statObject(MINIO_BUCKET, objectName).catch(() => null);
    if (!stat) return res.status(404).json({ message: 'File not found' });

    // Set content type and cache headers
    res.set('Content-Type', stat.metaData?.['content-type'] || 'application/octet-stream');
    res.set('Cache-Control', 'public, max-age=2592000, immutable');

    const stream = await client.getObject(MINIO_BUCKET, objectName);
    stream.pipe(res);
  } catch (err) {
    logger.error('MinIO proxy error', { message: err.message });
    res.status(500).json({ message: 'File retrieval failed' });
  }
});

// ── 4. NoSQL injection sanitization — strip $ and . from req.body/params ───
// Using a custom approach to avoid the issue with GET requests
app.use((req, res, next) => {
  // Only apply mongo sanitize for POST, PUT, PATCH requests that have body data
  if ((req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') && req.body) {
    mongoSanitize.sanitize(req.body);
  }
  // Sanitize query parameters for specific routes that need it
  if (req.query && (req.method === 'GET' || req.method === 'DELETE')) {
    // Only sanitize if there are actual parameters that could be malicious
    const unsafeParams = ['$ne', '$gt', '$gte', '$lt', '$lte', '$in', '$nin', '$exists', '$regex'];
    for (const param of unsafeParams) {
      if (req.query[param]) {
        delete req.query[param];
      }
    }
  }
  next();
});

// ── 5. HTTP Parameter Pollution protection ──────────────────────────────────
app.use(hpp({
  whitelist: ['sort', 'category', 'status', 'page', 'limit'],
}));

// ── 6. Role-aware rate limiter — tiered by role (PUBLIC/STAFF/DEPT/ADMIN) ──
// Replaces the old limiter that skipped ALL authenticated users.
app.use('/api/', (req, res, next) => {
  // Exempt webhook/callback paths (external services, no browser context)
  if (req.path.includes('/payments/mpesa/callback') || req.path.includes('/billing/mpesa-callback')) {
    return webhookLimiter(req, res, next);
  }
  // Apply role-aware global limiter to everything else
  return globalLimiter(req, res, next);
});

// ── 6a. Write-operation limiter — tighter quotas for mutations ──────────────
// POST/PUT/PATCH/DELETE get additional per-role limits.
const WRITE_EXEMPT_PATHS = [
  '/payments/mpesa/callback',
  '/billing/mpesa-callback',
  '/monetization/ads/impression', // Public tracking — anonymous, high volume
  '/monetization/ads/click', // Public tracking — anonymous, high volume
  '/monetization/promos/validate', // Pre-checkout validation
  '/analytics/events', // Consent-gated event ingestion
  '/v1/analytics/events', // Same path under v1 prefix
  '/errors', // Frontend error ingestion
  '/v1/errors', // Same path under v1 prefix
];
app.use('/api/', (req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    if (WRITE_EXEMPT_PATHS.some((p) => req.path.includes(p))) {
      return next();
    }
    return writeLimiter(req, res, next);
  }
  next();
});

// ── 7. Auth rate limiter — strict, IP-based (no JWT trust at this point) ───
// Apply to both /api/ (legacy) and /api/v1/ (canonical)
const authPaths = ['/api/auth', '/api/v1/auth'];
authPaths.forEach((base) => {
  app.use(`${base}/login`, authLimiter);
  app.use(`${base}/register`, authLimiter);
  app.use(`${base}/forgot-password`, authLimiter);
  app.use(`${base}/reset-password`, authLimiter);
});

// ── 7a. Heavy endpoint limiter — file uploads, bulk imports, exports ────────
app.use('/api/uploads', heavyLimiter);
app.use('/api/v1/uploads', heavyLimiter);
['/api/tech-hub', '/api/v1/tech-hub'].forEach((base) => {
  app.use(base, (req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return heavyLimiter(req, res, next);
    }
    next();
  });
});
app.use('/api/chat/callback', webhookLimiter);
app.use('/api/v1/chat/callback', webhookLimiter);

// ── Health check — exempt from rate limiter (placed before it) ──────────
const startTime = Date.now();
app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const states = {
    0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting',
  };
  const ok = dbState === 1;
  const mem = process.memoryUsage();
  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    db: states[dbState] || 'unknown',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    version: process.env.npm_package_version || '1.0.0',
    memory: {
      rss: Math.round(mem.rss / 1024 / 1024) + 'MB',
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024) + 'MB',
    },
    redis: isRedisConnected() ? 'connected' : 'disconnected',
    ...(dbState !== 1 && { hint: 'Set MONGO_URI in backend/.env and restart the server' }),
  });
});
app.get('/api/ready', (req, res) => {
  const dbState = mongoose.connection.readyState;
  if (dbState === 1) {
    res.status(200).json({ status: 'ready', db: 'connected' });
  } else {
    const dbStates = {
      0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting',
    };
    res.status(503).json({ status: 'not ready', db: dbStates[dbState] || 'unknown' });
  }
});

// ── Health detail — comprehensive metrics for the admin dashboard ─────
// Exempt from rate limiter (placed before it). Auth required.
app.get('/api/health/detail', async (req, res) => {
  try {
    const dbState = mongoose.connection.readyState;
    const states = {
      0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting',
    };

    // Get metrics snapshot
    const metricsData = metrics.snapshot();

    // Get collection counts if DB is connected
    const collections = {};
    if (dbState === 1) {
      try {
        const { db } = mongoose.connection;
        const collectionNames = ['users', 'products', 'orders', 'tickets', 'revenue', 'consultations', 'invoices', 'chatmessages', 'departments', 'services'];
        const counts = await Promise.all(
          collectionNames.map((name) => db.collection(name).countDocuments().catch(() => 0)),
        );
        collectionNames.forEach((name, i) => { collections[name] = counts[i]; });
      } catch { /* collection counts unavailable */ }
    }

    res.json({
      status: dbState === 1 ? 'ok' : 'degraded',
      db: {
        state: states[dbState] || 'unknown',
        connected: dbState === 1,
        host: mongoose.connection.host || 'unknown',
        name: mongoose.connection.name || 'unknown',
        collections,
      },
      redis: {
        connected: isRedisConnected(),
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || '6379',
      },
      ...metricsData,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ── M-Pesa callback — no rate limit (Safaricom calls this) ──────────────
// Exempt from global limiter by placing before it — already done above

// ── 7b. Request metrics collector ─────────────────────────────────────────
app.use(metricsMiddleware);

// ── 8. Request ID — unique X-Request-Id on every request ─────────────────────
app.use(requestId);

// ── 9. Request logger — structured per-request logging ──────────────────────
app.use(requestLogger);

// ── 10. API versioning ─────────────────────────────────────────────────────
// All API routes are registered under /api/v1/ (canonical).
// /api/ is a backward-compatible alias that rewrites to /api/v1/ with a Deprecation header.
// Infrastructure endpoints (/api/health, /api/docs) remain unversioned.

// Version headers on every response
app.use(versionHeaders);

// Legacy /api/* → /api/v1/* rewrite (adds Deprecation header)
// Must be app-level (not mounted on /api) so req.url retains full path
app.use(legacyAlias);

// ── 10a. Unversioned infrastructure ────────────────────────────────────────
// These stay at /api/ — not subject to versioning
// (health, readiness, swagger, csrf-token are registered before this block)

// ── 10b. Versioned API routes (canonical: /api/v1/) ────────────────────────
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/clients', require('./routes/clients'));
app.use('/api/v1/services', require('./routes/services'));
app.use('/api/v1/bookings', require('./routes/bookings'));
app.use('/api/v1/products', require('./routes/products'));
app.use('/api/v1/orders', require('./routes/orders'));
app.use('/api/v1/consultations', require('./routes/consultations'));
app.use('/api/v1/revenue', require('./routes/revenue'));
app.use('/api/v1/calculator', require('./routes/calculator'));
app.use('/api/v1/payments', webhookLimiter, require('./routes/payments'));
app.use('/api/v1/departments', require('./routes/departments'));
app.use('/api/v1/finance', require('./routes/finance'));
app.use('/api/v1/users', require('./routes/users'));
app.use('/api/v1/department-admins', require('./routes/departmentAdmins'));
app.use('/api/v1/dept', require('./routes/deptModules'));
app.use('/api/v1/track', require('./routes/track'));
app.use('/api/v1/admin', require('./routes/admin'));
app.use('/api/v1/tickets', require('./routes/publicTicketsTrack'));
app.use('/api/v1/tickets', require('./routes/tickets'));
app.use('/api/v1/staff-portal', require('./routes/staffPortal'));
app.use('/api/v1/staff-invitation', require('./routes/staffInvitation'));
app.use('/api/v1/inventory', require('./routes/inventory'));
app.use('/api/v1/billing', require('./routes/billing'));
app.use('/api/v1/crm', require('./routes/crm'));
app.use('/api/v1/chat', require('./routes/chat'));
app.use('/api/v1/help', require('./routes/help'));
app.use('/api/v1/email', require('./routes/email'));
app.use('/api/v1/ussd', require('./routes/ussd'));
app.use('/api/v1/devices', require('./routes/devices'));
app.use('/api/v1/analytics', require('./routes/analytics'));
app.use('/api/v1/analytics/departments', require('./routes/departmentAnalytics'));
app.use('/api/v1/analytics/departments/pdf', require('./routes/departmentAnalyticsPdf'));
app.use('/api/v1/payment-history', require('./routes/paymentHistory'));
app.use('/api/v1/deployment', require('./routes/deployment'));
app.use('/api/v1/db-health', require('./routes/dbHealth'));
app.use('/api/v1/connection-pool', require('./routes/connectionPool'));
app.use('/api/v1/webhook-config', require('./routes/webhookConfig'));
app.use('/api/v1/tech-hub/public', require('./routes/techHubPublic'));
app.use('/api/v1/tech-hub', require('./routes/techHub'));
app.use('/api/v1/meetings', require('./routes/meetings'));
app.use('/api/v1/monetization', require('./routes/monetization'));
app.use('/api/v1/errors', require('./routes/errors'));

// ── 10c. Swagger API docs (unversioned) ───────────────────────────────────
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'PCL API Documentation',
}));
app.get('/api/docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// ── 10d. API version discovery endpoint ────────────────────────────────────
app.get('/api/versions', (req, res) => {
  res.json({
    current: 'v1',
    available: ['v1'],
    deprecated: [],
    latest: 'v1',
    docs: '/api/docs',
  });
});

// ── 11. 404 handler ──────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use(require('./middleware/errorHandler'));

// ── 12. Start server + Socket.io ─────────────────────────────────────────────
const { initSocket } = require('./socket');

const PORT = process.env.PORT || 5001;
const httpServer = http.createServer(app);

initSocket(httpServer); // attach Socket.io to the http server

httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logger.error(`Port ${PORT} is already in use. Run: fuser -k ${PORT}/tcp`);
    process.exit(1);
  } else {
    throw err;
  }
});

// ── Connect DB then start listening ──────────────────────────────────────
connectDB().then(() => {
  dbReady = true;
  // Initialize Redis connection (non-blocking, falls back gracefully)
  getRedisClient();
  try {
    require('./cron/jobs')();
    setupIndexes().catch((e) => logger.warn('Index setup warning', { message: e.message }));
  } catch (e) {
    logger.error('Startup error', { message: e.message });
  }

  // Start listening only after DB is connected
  httpServer.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info('Socket.io attached — real-time events active');
    logger.info(`Health: http://localhost:${PORT}/api/health`);
  });
}).catch((err) => {
  // If DB connection fails, start anyway (degraded mode)
  logger.error('MongoDB connection failed', { message: err.message });
  logger.warn('Starting server in degraded mode — some features unavailable');
  httpServer.listen(PORT, () => {
    logger.warn(`Server running on port ${PORT} in degraded mode (no DB)`);
    logger.info('Socket.io attached — real-time events active');
    logger.info(`Health: http://localhost:${PORT}/api/health`);
  });
});

// ── Graceful shutdown ──────────────────────────────────────────────────────
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received — shutting down gracefully');
  httpServer.close(() => {
    disconnectRedis().then(() => process.exit(0)).catch(() => process.exit(0));
  });
});
process.on('SIGINT', async () => {
  logger.info('SIGINT received — shutting down gracefully');
  httpServer.close(() => {
    disconnectRedis().then(() => process.exit(0)).catch(() => process.exit(0));
  });
});
