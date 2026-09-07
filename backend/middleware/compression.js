// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// Response compression middleware — gzip (via compression package) + brotli (native Node.js).
// Brotli offers 15-25% better compression than gzip for text/JSON responses.
//
// How it works:
//   1. Check Accept-Encoding header from the client
//   2. If client supports brotli → use native zlib.brotliCompress
//   3. Otherwise → fall back to gzip (via compression package)
//   4. Skip compression for small responses (< 1KB), binary streams, and SSE

const compression = require('compression');
const zlib = require('zlib');
const logger = require('../utils/logger');

const MIN_SIZE = 1024; // Don't compress responses smaller than 1KB
const BROTLI_QUALITY = 4; // Balanced (0-11, higher = slower but better)
const GZIP_LEVEL = 6; // Default gzip level (1-9)

// MIME types that benefit from compression
const COMPRESSIBLE_TYPES = new Set([
  'application/json',
  'application/javascript',
  'text/javascript',
  'text/html',
  'text/plain',
  'text/css',
  'text/xml',
  'application/xml',
  'application/rss+xml',
  'application/atom+xml',
  'image/svg+xml',
  'application/vnd.ms-fontobject',
  'font/opentype',
  'application/x-font-ttf',
]);

// MIME types that should NEVER be compressed (already compressed or binary)
const SKIP_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/avif',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/ogg',
  'application/zip',
  'application/gzip',
  'application/x-brotli',
  'application/pdf',
  'application/octet-stream',
]);

// Paths that should skip compression (streaming/proxy endpoints)
const SKIP_PATHS = [
  '/uploads/', // MinIO proxy — streams binary objects
  '/ws',       // WebSocket upgrade
];

/**
 * Should this response be compressed?
 */
function shouldCompress(req, res) {
  // Don't compress if client doesn't support it
  const encoding = req.headers['accept-encoding'] || '';
  if (!encoding) return false;

  // Don't compress SSE or streaming responses
  const contentType = res.getHeader('content-type') || '';
  if (contentType.includes('text/event-stream')) return false;

  // Don't compress if explicitly disabled
  if (res.getHeader('x-no-compression')) return false;

  // Skip binary MIME types
  const baseType = contentType.split(';')[0].trim().toLowerCase();
  if (SKIP_TYPES.has(baseType)) return false;

  // Only compress text-like MIME types
  if (!COMPRESSIBLE_TYPES.has(baseType) && !baseType.startsWith('text/')) return false;

  return true;
}

/**
 * Compress response body with brotli (preferred) or gzip (fallback).
 */
function compressBody(body, encoding, res) {
  const acceptEncoding = (encoding || '').toLowerCase();

  // Prefer brotli if client supports it
  if (acceptEncoding.includes('br')) {
    try {
      const compressed = zlib.brotliCompressSync(body, {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY,
          [zlib.constants.BROTLI_PARAM_SIZE_HINT]: body.length,
        },
      });
      // Only use if it's actually smaller
      if (compressed.length < body.length) {
        return { data: compressed, encoding: 'br' };
      }
    } catch {
      // Fall through to gzip
    }
  }

  // Fall back to gzip
  if (acceptEncoding.includes('gzip')) {
    try {
      const compressed = zlib.gzipSync(body, { level: GZIP_LEVEL });
      if (compressed.length < body.length) {
        return { data: compressed, encoding: 'gzip' };
      }
    } catch {
      // Fall through to no compression
    }
  }

  return null; // No compression applied
}

/**
 * Custom compression middleware — intercepts res.json() and res.send().
 * Uses brotli when the client supports it, falls back to gzip.
 */
function brotliCompression(req, res, next) {
  // Skip excluded paths
  if (SKIP_PATHS.some((p) => req.path.startsWith(p))) {
    return next();
  }

  // Check if client accepts any encoding
  const acceptEncoding = req.headers['accept-encoding'] || '';
  if (!acceptEncoding) return next();

  // Intercept res.json() and res.send() to compress the output
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  function compressAndSend(originalFn, body) {
    // If body is a stream or already compressed, don't touch it
    if (body && typeof body === 'object' && typeof body.pipe === 'function') {
      return originalFn(body);
    }

    // Check content type after it's set
    const contentType = res.getHeader('content-type') || '';
    const baseType = contentType.split(';')[0].trim().toLowerCase();

    // Skip non-compressible types
    if (SKIP_TYPES.has(baseType) || (!COMPRESSIBLE_TYPES.has(baseType) && !baseType.startsWith('text/'))) {
      return originalFn(body);
    }

    // Skip small responses
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    if (Buffer.byteLength(bodyStr) < MIN_SIZE) {
      return originalFn(body);
    }

    // Compress
    const result = compressBody(Buffer.from(bodyStr), acceptEncoding, res);
    if (result) {
      res.setHeader('Content-Encoding', result.encoding);
      res.setHeader('Content-Length', result.data.length);
      // Remove Content-Type if not set (will be set by express)
      if (!contentType) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
      }
      return originalFn(result.data);
    }

    return originalFn(body);
  }

  // Override res.json
  res.json = function (body) {
    return compressAndSend(originalJson, body);
  };

  // Override res.send
  res.send = function (body) {
    return compressAndSend(originalSend, body);
  };

  next();
}

/**
 * Fallback gzip middleware using the compression package.
 * Applied AFTER brotli middleware for any responses that slipped through
 * (e.g., non-intercepted text responses like res.write()).
 */
const gzipFallback = compression({
  level: GZIP_LEVEL,
  threshold: MIN_SIZE,
  filter: (req, res) => {
    // Only compress if brotli middleware didn't already handle it
    if (res.getHeader('content-encoding')) return false;
    return shouldCompress(req, res);
  },
});

module.exports = {
  brotliCompression,
  gzipFallback,
};
