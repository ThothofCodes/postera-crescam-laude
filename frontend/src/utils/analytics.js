// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// Consent-gated analytics — only fires events when user has analytics consent.
//
// How it works:
//   1. Every track() call checks hasConsent('analytics') first
//   2. If consent is denied, the call is a silent no-op (zero overhead)
//   3. Events are stored in localStorage for batch sending
//   4. When consent is given, queued events are flushed to the backend
//   5. When consent is revoked, the queue is cleared
//
// Usage:
//   import { track } from '../utils/analytics';
//   track('product_viewed', { productId: '123', name: 'Laptop' });
//   track('order_created', { orderId: 'RTS-001', total: 5000 });

import { hasConsent, getConsent } from '../components/CookieConsent';

const QUEUE_KEY = 'pcl_analytics_queue';
const SESSION_ID_KEY = 'pcl_session_id';
const MAX_QUEUE_SIZE = 100;
const FLUSH_INTERVAL_MS = 30000; // Flush every 30 seconds
const API_ENDPOINT = '/api/v1/analytics/events';

// ── Session ID ─────────────────────────────────────────────────────────────

function getSessionId() {
  let id = localStorage.getItem(SESSION_ID_KEY);
  if (!id) {
    id = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    localStorage.setItem(SESSION_ID_KEY, id);
  }
  return id;
}

// ── Queue management ───────────────────────────────────────────────────────

function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

function setQueue(queue) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // localStorage full — trim oldest
    const trimmed = queue.slice(-MAX_QUEUE_SIZE);
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(trimmed)); } catch {}
  }
}

function clearQueue() {
  try { localStorage.removeItem(QUEUE_KEY); } catch {}
}

// ── Flush queue to backend ─────────────────────────────────────────────────

let flushTimer = null;

async function flushQueue() {
  if (!hasConsent('analytics')) {
    clearQueue();
    return;
  }

  const queue = getQueue();
  if (queue.length === 0) return;

  try {
    // Use sendBeacon for reliability (works even during page unload)
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify({ events: queue })], { type: 'application/json' });
      navigator.sendBeacon(API_ENDPOINT, blob);
      clearQueue();
    } else {
      // Fallback to fetch
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: queue }),
        keepalive: true,
      });
      if (response.ok) clearQueue();
    }
  } catch {
    // Network error — keep queue for next flush attempt
  }
}

function startFlushTimer() {
  if (flushTimer) return;
  flushTimer = setInterval(flushQueue, FLUSH_INTERVAL_MS);

  // Flush on page hide (before unload)
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushQueue();
    });
  }
}

// ── Core tracking function ─────────────────────────────────────────────────

/**
 * Track an analytics event. Only fires if user has analytics consent.
 * Silent no-op otherwise — zero overhead for non-consenting users.
 *
 * @param {string} eventName - Event name (e.g. 'product_viewed', 'order_created')
 * @param {object} properties - Event properties (serialized to JSON)
 */
export function track(eventName, properties = {}) {
  // Gate on consent — this is the critical check
  if (!hasConsent('analytics')) return;

  const event = {
    event: eventName,
    timestamp: new Date().toISOString(),
    sessionId: getSessionId(),
    url: window.location.pathname,
    ...properties,
  };

  const queue = getQueue();
  queue.push(event);

  // Trim if too large
  if (queue.length > MAX_QUEUE_SIZE) {
    queue.splice(0, queue.length - MAX_QUEUE_SIZE);
  }

  setQueue(queue);
  startFlushTimer();
}

/**
 * Track a page view. Call this in page components or a route change listener.
 */
export function trackPageView(path, title) {
  track('page_viewed', { path, title });
}

/**
 * Track a user action with timing.
 */
export function trackAction(action, properties = {}) {
  track(action, { ...properties, userAgent: navigator.userAgent });
}

// ── Listen for consent changes ─────────────────────────────────────────────

// When analytics consent is granted, flush any queued events
// When analytics consent is revoked, clear the queue
if (typeof window !== 'undefined') {
  window.addEventListener('cookie-consent-updated', (e) => {
    const consent = e.detail;
    if (consent?.categories?.analytics) {
      // Consent granted — flush queued events
      flushQueue();
    } else {
      // Consent revoked — clear queue
      clearQueue();
    }
  });
}

// ── Auto-flush on page load ────────────────────────────────────────────────
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    setTimeout(flushQueue, 2000); // Small delay to let page settle
  });
}

// ── Convenience event trackers ─────────────────────────────────────────────

export const analytics = {
  // Auth
  login: (email) => track('user_logged_in', { email }),
  logout: () => track('user_logged_out'),
  register: (role) => track('user_registered', { role }),

  // Products
  productViewed: (id, name, price) => track('product_viewed', { productId: id, name, price }),
  productSearched: (query, resultCount) => track('product_searched', { query, resultCount }),
  addToCart: (productId, name, quantity, price) => track('add_to_cart', { productId, name, quantity, price }),

  // Orders
  orderCreated: (orderId, total, itemCount) => track('order_created', { orderId, total, itemCount }),
  orderPaid: (orderId, total, method) => track('order_paid', { orderId, total, paymentMethod: method }),

  // Bookings
  bookingCreated: (serviceId, date) => track('booking_created', { serviceId, date }),

  // Consultations
  consultationBooked: (type, medium) => track('consultation_booked', { type, medium }),

  // Meetings
  meetingCreated: (title, participants) => track('meeting_created', { title, participantCount: participants }),
  meetingJoined: (meetingId) => track('meeting_joined', { meetingId }),

  // Calculator
  estimateRequested: (service, tier) => track('estimate_requested', { service, tier }),

  // Tickets
  ticketCreated: (department, priority) => track('ticket_created', { department, priority }),

  // Search
  searchPerformed: (query, resultCount) => track('search_performed', { query, resultCount }),

  // Navigation
  pageViewed: trackPageView,
};

export default analytics;
