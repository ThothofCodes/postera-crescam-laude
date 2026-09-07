// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// Structured logger built on Winston — JSON transport, file rotation, request context enrichment.

const winston = require('winston');
const path = require('path');

const {
  combine, timestamp, json, printf, colorize, errors,
} = winston.format;

// ── Custom format for console readability in development ──────────────────────
const devFormat = printf(({
  level, message, timestamp: ts, stack, ...meta
}) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return stack
    ? `${ts} ${level}: ${message}\n${stack}${metaStr}`
    : `${ts} ${level}: ${message}${metaStr}`;
});

// ── Log directory ─────────────────────────────────────────────────────────────
const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '..', 'logs');

// ── Log level ─────────────────────────────────────────────────────────────────
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// ── Winston transport selection ────────────────────────────────────────────────
const transports = [];

// Console transport — always present
transports.push(
  new winston.transports.Console({
    level: LOG_LEVEL,
    format: process.env.NODE_ENV === 'production'
      ? combine(timestamp(), json())
      : combine(colorize(), timestamp({ format: 'HH:mm:ss' }), devFormat),
  }),
);

// File transports — production only
if (process.env.NODE_ENV === 'production') {
  transports.push(
    // All logs
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'combined.log'),
      level: LOG_LEVEL,
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 5,
      tailable: true,
    }),
    // Error logs only
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
      tailable: true,
    }),
  );
}

// ── Create logger instance ────────────────────────────────────────────────────
const logger = winston.createLogger({
  level: LOG_LEVEL,
  levels: {
    error: 0, warn: 1, info: 2, http: 3, debug: 4,
  },
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  ),
  transports,
  // Don't exit on uncaught exceptions — let the process handler deal with it
  exitOnError: false,
});

// ── Request context enrichment helper ─────────────────────────────────────────
// Attach to req.logger = logger.child({ requestId: req.id, userId: req.user?.id })
logger.child = (bindings) => {
  const childLogger = logger.child ? winston.createLogger({
    level: LOG_LEVEL,
    levels: logger.levels,
    format: combine(
      errors({ stack: true }),
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    ),
    defaultMeta: bindings,
    transports,
    exitOnError: false,
  }) : logger;
  return childLogger;
};

module.exports = logger;
