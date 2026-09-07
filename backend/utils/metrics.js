// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// In-memory request metrics collector — lightweight, zero-dependency.
// Tracks request count, error rates, response times, and active connections.
// Data is ephemeral (resets on server restart) by design.

const os = require('os');

class MetricsCollector {
  constructor() {
    this.startedAt = new Date();
    this.requestCount = 0;
    this.errorCount = 0;
    this.statusCodeCounts = {}; // { 200: 123, 404: 5, 500: 2 }
    this.responseTimes = []; // rolling window of last 200 response times (ms)
    this.activeConnections = 0;
    this.routes = {}; // { '/api/products': { count: 42, avgMs: 12, errors: 1 } }
    this._maxWindow = 200; // keep last N response time samples
    this._errorWindow = []; // rolling window of recent errors
    this._maxErrors = 50; // keep last N error entries
  }

  // Call from middleware at start of request
  onRequestStart(req) {
    this.requestCount++;
    this.activeConnections++;
    req._metricsStart = Date.now();
  }

  // Call from middleware at end of request
  onRequestEnd(req, res) {
    this.activeConnections = Math.max(0, this.activeConnections - 1);

    const duration = Date.now() - (req._metricsStart || Date.now());
    const status = res.statusCode;
    const route = this._extractRoute(req);

    // Status code distribution
    this.statusCodeCounts[status] = (this.statusCodeCounts[status] || 0) + 1;

    // Error tracking
    if (status >= 400) {
      this.errorCount++;
      this._errorWindow.push({
        timestamp: new Date(),
        method: req.method,
        path: req.originalUrl,
        status,
        duration,
        ip: req.ip,
      });
      if (this._errorWindow.length > this._maxErrors) {
        this._errorWindow.shift();
      }
    }

    // Response time rolling window
    this.responseTimes.push(duration);
    if (this.responseTimes.length > this._maxWindow) {
      this.responseTimes.shift();
    }

    // Per-route stats
    if (route) {
      if (!this.routes[route]) {
        this.routes[route] = { count: 0, totalMs: 0, errors: 0 };
      }
      const r = this.routes[route];
      r.count++;
      r.totalMs += duration;
      if (status >= 400) r.errors++;
    }
  }

  // Extract route pattern (strip query params, collapse IDs)
  _extractRoute(req) {
    if (!req.route) return req.path;
    // Express exposes the route pattern on req.route.path
    const base = req.baseUrl + req.route.path;
    return base.replace(/\/[0-9a-f]{24}/gi, '/:id').replace(/\/\d+/g, '/:id');
  }

  // Get full snapshot for the health dashboard
  snapshot() {
    const uptimeMs = Date.now() - this.startedAt.getTime();
    const uptimeSec = Math.floor(uptimeMs / 1000);
    const mem = process.memoryUsage();
    const cpus = os.cpus();

    // Response time stats
    const sorted = [...this.responseTimes].sort((a, b) => a - b);
    const avg = sorted.length
      ? Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length)
      : 0;
    const p50 = sorted.length ? sorted[Math.floor(sorted.length * 0.5)] : 0;
    const p95 = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : 0;
    const p99 = sorted.length ? sorted[Math.floor(sorted.length * 0.99)] : 0;

    // Error rate
    const totalRequests = this.requestCount || 1;
    const errorRate = ((this.errorCount / totalRequests) * 100).toFixed(2);

    // Top error routes
    const topErrorRoutes = Object.entries(this.routes)
      .filter(([, v]) => v.errors > 0)
      .sort((a, b) => b[1].errors - a[1].errors)
      .slice(0, 10)
      .map(([route, v]) => ({
        route,
        errors: v.errors,
        count: v.count,
        errorRate: ((v.errors / v.count) * 100).toFixed(1) + '%',
        avgMs: Math.round(v.totalMs / v.count),
      }));

    // Top slow routes
    const topSlowRoutes = Object.entries(this.routes)
      .sort((a, b) => (b[1].totalMs / b[1].count) - (a[1].totalMs / a[1].count))
      .slice(0, 10)
      .map(([route, v]) => ({
        route,
        count: v.count,
        avgMs: Math.round(v.totalMs / v.count),
        errors: v.errors,
      }));

    return {
      uptime: {
        seconds: uptimeSec,
        formatted: this._formatUptime(uptimeSec),
        startedAt: this.startedAt.toISOString(),
      },
      memory: {
        rss: Math.round(mem.rss / 1024 / 1024),
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
        external: Math.round(mem.external / 1024 / 1024),
        rssFormatted: this._formatBytes(mem.rss),
        heapUsedFormatted: this._formatBytes(mem.heapUsed),
        heapTotalFormatted: this._formatBytes(mem.heapTotal),
      },
      requests: {
        total: this.requestCount,
        active: this.activeConnections,
        errors: this.errorCount,
        errorRate: errorRate + '%',
        statusCodes: { ...this.statusCodeCounts },
      },
      responseTime: {
        avg,
        p50,
        p95,
        p99,
        unit: 'ms',
      },
      system: {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        cpuCount: cpus.length,
        cpuModel: cpus[0]?.model || 'unknown',
        loadAverage: os.loadavg().map((v) => v.toFixed(2)),
        freeMemory: this._formatBytes(os.freemem()),
        totalMemory: this._formatBytes(os.totalmem()),
      },
      topErrorRoutes,
      topSlowRoutes,
      recentErrors: this._errorWindow.slice(-20),
    };
  }

  _formatUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const parts = [];
    if (d) parts.push(`${d}d`);
    if (h) parts.push(`${h}h`);
    if (m) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
  }

  _formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}

// Singleton
const metrics = new MetricsCollector();

// Express middleware factory
function metricsMiddleware(req, res, next) {
  metrics.onRequestStart(req);
  res.on('finish', () => metrics.onRequestEnd(req, res));
  next();
}

module.exports = { metrics, metricsMiddleware };
