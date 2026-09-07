// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// ErrorLog — self-hosted error tracking model for frontend and backend errors.

const mongoose = require('mongoose');

const errorLogSchema = new mongoose.Schema({
  // Source: 'frontend' | 'backend' | 'unhandled'
  source: {
    type: String,
    enum: ['frontend', 'backend', 'unhandled'],
    required: true,
    index: true,
  },

  // Error classification
  level: {
    type: String,
    enum: ['error', 'warning', 'info'],
    default: 'error',
    index: true,
  },

  // Error message
  message: {
    type: String,
    required: true,
    index: true,
  },

  // Error name/type (e.g., TypeError, ReferenceError, AppError)
  name: {
    type: String,
    index: true,
  },

  // Stack trace (cleaned of base URLs for frontend errors)
  stack: {
    type: String,
  },

  // ── Request context (backend errors) ────────────────────────────────────
  method: String, // HTTP method
  path: String, // Request path
  statusCode: Number, // Response status code
  requestId: String, // X-Request-Id
  ip: String, // Client IP
  userAgent: String, // User-Agent header

  // ── User context ────────────────────────────────────────────────────────
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  },
  userEmail: String,
  userRole: String,

  // ── Frontend context ────────────────────────────────────────────────────
  url: String, // Full page URL
  pagePath: String, // pathname only
  componentStack: String, // React component stack (if component error)
  lineNumber: Number, // Source line number (JS error)
  columnNumber: Number, // Source column number (JS error)
  fileName: String, // Source file URL

  // ── Environment / version ───────────────────────────────────────────────
  environment: {
    type: String,
    enum: ['development', 'test', 'production'],
    default: 'production',
  },
  appVersion: String, // Frontend build version
  nodeVersion: String, // Backend Node.js version

  // ── Occurrence tracking ─────────────────────────────────────────────────
  fingerprint: { // Hash of message + stack + path for grouping
    type: String,
    index: true,
  },
  count: {
    type: Number,
    default: 1,
  },
  firstOccurrence: Date,
  lastOccurrence: Date,

  // ── Resolution ──────────────────────────────────────────────────────────
  status: {
    type: String,
    enum: ['open', 'investigating', 'resolved', 'ignored'],
    default: 'open',
    index: true,
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  resolvedAt: Date,
  notes: String,
}, {
  timestamps: true,
});

// Compound indexes for common queries
errorLogSchema.index({ source: 1, createdAt: -1 });
errorLogSchema.index({ status: 1, createdAt: -1 });
errorLogSchema.index({ fingerprint: 1, status: 1 });
errorLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // 90-day TTL

module.exports = mongoose.model('ErrorLog', errorLogSchema);
