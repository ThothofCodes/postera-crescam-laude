// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// Self-hosted error tracker — captures frontend errors and batches them
// for upload to /api/v1/errors (our own server, no third-party service).

const BATCH_SIZE = 10;
const FLUSH_INTERVAL_MS = 30000;
const QUEUE_KEY = 'pcl_error_queue';

// ── Queue management ────────────────────────────────────────────────────────

function getQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); }
  catch { return []; }
}

function setQueue(queue) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue)); }
  catch { /* storage full */ }
}

function clearQueue() {
  try { localStorage.removeItem(QUEUE_KEY); } catch {}
}

// ── Flush to backend ────────────────────────────────────────────────────────

let flushTimer = null;

async function flushErrors() {
  const queue = getQueue();
  if (queue.length === 0) return;

  try {
    // Use sendBeacon for reliability during page unload
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify({ errors: queue })], { type: 'application/json' });
      navigator.sendBeacon('/api/v1/errors', blob);
      clearQueue();
    } else {
      const res = await fetch('/api/v1/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ errors: queue }),
        keepalive: true,
      });
      if (res.ok) clearQueue();
    }
  } catch {
    // Keep queue for next attempt
  }
}

function startFlushTimer() {
  if (flushTimer) return;
  flushTimer = setInterval(flushErrors, FLUSH_INTERVAL_MS);

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushErrors();
    });
  }
}

// ── Capture an error ────────────────────────────────────────────────────────

function captureError(error, extra = {}) {
  const errorEntry = {
    source: 'frontend',
    level: extra.level || 'error',
    message: error.message || String(error),
    name: error.name || error.constructor?.name || 'Error',
    stack: error.stack,
    url: window.location.href,
    pagePath: window.location.pathname,
    userAgent: navigator.userAgent,
    appVersion: import.meta?.env?.VITE_APP_VERSION || undefined,
    environment: import.meta?.env?.MODE || 'production',
    ...extra,
  };

  const queue = getQueue();
  queue.push(errorEntry);

  // Trim if too large
  if (queue.length > BATCH_SIZE * 5) {
    queue.splice(0, queue.length - BATCH_SIZE * 5);
  }

  setQueue(queue);

  if (queue.length >= BATCH_SIZE) {
    flushErrors();
  } else {
    startFlushTimer();
  }
}

// ── Capture a React component error (called from ErrorBoundary) ─────────────

function captureComponentError(error, componentStack) {
  captureError(error, {
    componentStack,
    level: 'error',
  });
}

// ── Install global handlers ─────────────────────────────────────────────────

let installed = false;

export function initErrorTracker() {
  if (installed) return;
  if (typeof window === 'undefined') return;
  installed = true;

  // Global JS errors
  window.addEventListener('error', (event) => {
    // Skip if it's a cross-origin script error (no useful info)
    if (event.filename && event.filename !== window.location.href) return;

    captureError(event.error || new Error(event.message || 'Unknown error'), {
      lineNumber: event.lineno,
      columnNumber: event.colno,
      fileName: event.filename,
    });
  });

  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const error = reason instanceof Error ? reason : new Error(String(reason));
    captureError(error, { name: 'UnhandledRejection' });
  });

  // Flush on page unload
  window.addEventListener('beforeunload', () => {
    flushErrors();
  });
}

// ── Convenience methods ─────────────────────────────────────────────────────

export const errorTracker = {
  /** Capture a caught error with context */
  capture(error, extra) {
    captureError(error, extra);
  },

  /** Capture a component error (from ErrorBoundary) */
  captureComponent(error, componentStack) {
    captureComponentError(error, componentStack);
  },

  /** Capture a manual message as an error */
  captureMessage(message, level = 'error') {
    captureError(new Error(message), { level, name: 'ManualCapture' });
  },

  /** Set user context for subsequent errors */
  setUser(user) {
    try {
      localStorage.setItem('pcl_error_user', JSON.stringify({
        id: user?._id,
        email: user?.email,
        role: user?.role,
      }));
    } catch {}
  },

  /** Clear user context */
  clearUser() {
    try { localStorage.removeItem('pcl_error_user'); } catch {}
  },

  /** Manually flush the queue */
  flush: flushErrors,
};

export default errorTracker;
