// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// Redis cache middleware — transparent response caching with TTL and pattern-based invalidation.
// Falls back to no-op when Redis is unavailable, so the app always works.

const { getClient, isConnected } = require('../config/redis');

// Default TTLs (seconds)
const TTL = {
  SHORT: 30, // Dashboard stats, analytics summaries
  MEDIUM: 60, // Product listings, search results
  LONG: 120, // Featured products, services, single items
  STATIC: 300, // Departments, rarely-changing data
};

/**
 * Build a cache key from request properties.
 * Format: pcl:{prefix}:{querystring_hash}
 */
function buildKey(prefix, req) {
  // Include query params and user role in key for role-scoped caching
  const { query, method } = req;
  const role = req.user?.role || 'public';
  const sorted = Object.keys(query)
    .sort()
    .map((k) => `${k}=${query[k]}`)
    .join('&');
  const hash = require('crypto')
    .createHash('md5')
    .update(`${method}:${sorted}:${role}`)
    .digest('hex')
    .slice(0, 12);
  return `${prefix}:${hash}`;
}

/**
 * Express middleware factory — caches GET responses.
 * @param {string} prefix  — cache key prefix (e.g. 'products', 'analytics')
 * @param {number} ttl     — time-to-live in seconds (default 60)
 * @param {object} [opts]  — { varyByUser: false, skipCache: fn }
 */
function cacheMiddleware(prefix, ttl = TTL.MEDIUM, _opts = {}) {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET' || !isConnected()) return next();

    const client = getClient();
    const key = buildKey(prefix, req);

    try {
      const cached = await client.get(key);
      if (cached) {
        const data = JSON.parse(cached);
        res.set('X-Cache', 'HIT');
        return res.json(data);
      }
    } catch (err) {
      // Redis read failed — proceed without cache
    }

    // Intercept res.json to cache the response
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const innerClient = getClient();
        if (isConnected()) {
          innerClient.set(key, JSON.stringify(body), 'EX', ttl).catch(() => {});
        }
      }
      res.set('X-Cache', 'MISS');
      return originalJson(body);
    };

    next();
  };
}

/**
 * Invalidate cache entries matching a prefix pattern.
 * Use after write operations (create/update/delete) to keep cache fresh.
 * @param {string} prefix — prefix to match (e.g. 'products' clears all product caches)
 */
async function invalidateCache(prefix) {
  if (!isConnected()) return;
  const client = getClient();
  try {
    // ioredis with keyPrefix — the actual Redis key includes the prefix
    const fullPrefix = `${prefix}:`;
    // Use SCAN to find keys (safe for production)
    let cursor = '0';
    let deleted = 0;
    do {
      const [nextCursor, keys] = await client.scan(cursor, 'MATCH', `${fullPrefix}*`, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await client.del(...keys);
        deleted += keys.length;
      }
    } while (cursor !== '0');
    if (deleted > 0) {
      console.log(`[Cache] Invalidated ${deleted} keys for prefix: ${prefix}`);
    }
  } catch (err) {
    console.warn('[Cache] Invalidation error:', err.message);
  }
}

/**
 * Invalidate multiple prefixes at once.
 */
async function invalidateMultiple(prefixes) {
  await Promise.all(prefixes.map(invalidateCache));
}

module.exports = {
  cacheMiddleware,
  invalidateCache,
  invalidateMultiple,
  TTL,
  buildKey,
};
