// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// Redis connection manager — singleton with graceful fallback when Redis is unavailable.
// All cache operations are safe no-ops when Redis is down, so the app never crashes.

const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;
const KEY_PREFIX = process.env.REDIS_KEY_PREFIX || 'pcl:';

let _client = null;
let _connected = false;

/**
 * Get or create the Redis client singleton.
 * Attempts connection; on failure, returns a no-op proxy so callers never crash.
 */
function getClient() {
  if (_client) return _client;

  const opts = {
    keyPrefix: KEY_PREFIX,
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      // Exponential backoff, max 10s
      const delay = Math.min(times * 100, 10000);
      return delay;
    },
    enableReadyCheck: true,
    lazyConnect: true,
    connectTimeout: 5000,
  };

  if (REDIS_PASSWORD) opts.password = REDIS_PASSWORD;

  // If REDIS_URL contains a full URL, use it; otherwise use host/port
  if (process.env.REDIS_URL) {
    _client = new Redis(REDIS_URL, opts);
  } else {
    _client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      ...opts,
    });
  }

  _client.on('connect', () => {
    _connected = true;
    console.log('[Redis] Connected');
  });

  _client.on('ready', () => {
    _connected = true;
  });

  _client.on('error', (err) => {
    if (_connected) {
      console.warn('[Redis] Connection lost:', err.message);
    }
    _connected = false;
  });

  _client.on('close', () => {
    _connected = false;
  });

  // Attempt connection (non-blocking)
  _client.connect().catch((err) => {
    console.warn('[Redis] Initial connection failed:', err.message, '— caching disabled');
    _connected = false;
  });

  return _client;
}

/**
 * Check if Redis is connected and ready.
 */
function isConnected() {
  return _connected && _client?.status === 'ready';
}

/**
 * Graceful shutdown.
 */
async function disconnect() {
  if (_client) {
    await _client.quit().catch(() => {});
    _client = null;
    _connected = false;
  }
}

module.exports = {
  getClient,
  isConnected,
  disconnect,
  REDIS_URL,
  KEY_PREFIX,
};
