// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// API Versioning middleware — adds version headers and manages backward-compatible aliases.
//
// How it works:
//   1. All routes are registered under /api/v1/ (canonical)
//   2. /api/ is a backward-compatible alias that rewrites to /api/v1/
//   3. Response headers include API-Version and Deprecation warnings
//   4. /api/docs and /api/health remain unversioned (infrastructure)
//
// Migration guide:
//   - Current: GET /api/products
//   - New:     GET /api/v1/products
//   - /api/ continues to work but sends Deprecation header
//   - Remove /api/ alias in v2.0

const API_VERSION = '1';
const API_VERSION_HEADER = 'API-Version';
const DEPRECATION_HEADER = 'Deprecation';
const SUNSET_HEADER = 'Sunset';

// Paths that are NOT versioned (infrastructure endpoints)
const UNVERSIONED_PATHS = [
  '/api/health',
  '/api/ready',
  '/api/health/detail',
  '/api/docs',
  '/api/docs.json',
];

/**
 * Middleware that adds API version headers to all responses.
 */
function versionHeaders(req, res, next) {
  // Set version header on every response
  res.setHeader(API_VERSION_HEADER, API_VERSION);

  // Check if this is a legacy /api/ request (not /api/v1/)
  const isLegacy = req.path.startsWith('/api/') && !req.path.startsWith('/api/v1/');

  // Only add deprecation header for actual API routes (not infrastructure)
  const isUnversioned = UNVERSIONED_PATHS.some((p) => req.path.startsWith(p));

  if (isLegacy && !isUnversioned) {
    res.setHeader(DEPRECATION_HEADER, 'true');
    res.setHeader('Link', `</api/v1${req.path.substring(4)}>; rel="successor-version"`);
  }

  next();
}

/**
 * Rewrite /api/* to /api/v1/* for backward compatibility.
 * Preserves query string and method.
 */
function legacyAlias(req, res, next) {
  const url = req.originalUrl || req.url;
  // Only rewrite /api/ paths that don't already start with /api/v1/
  if (url.startsWith('/api/') && !url.startsWith('/api/v1/')) {
    // Skip unversioned infrastructure paths
    const isUnversioned = UNVERSIONED_PATHS.some((p) => url.startsWith(p)) || url.startsWith('/api/versions');
    if (!isUnversioned) {
      req.url = '/api/v1' + url.substring(4);
      req.path = '/api/v1' + (req.path || url).substring(4);
    }
  }
  next();
}

/**
 * Get the current API version.
 */
function getVersion() {
  return API_VERSION;
}

module.exports = {
  versionHeaders,
  legacyAlias,
  getVersion,
  API_VERSION,
  API_VERSION_HEADER,
};
