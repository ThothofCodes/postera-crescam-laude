// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// PCL — Circuit Canopy Cookie Consent Banner
// GDPR/CCPA compliant cookie consent with granular category control.

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';

const STORAGE_KEY = 'pcl_cookie_consent';
const RECONSENT_INTERVAL_MS = 180 * 24 * 60 * 60 * 1000; // 6 months

// Cookie categories — what each controls
const CATEGORIES = [
  {
    id: 'essential',
    label: 'Essential',
    description: 'Required for login, security, and core functionality. Cannot be disabled.',
    required: true,
  },
  {
    id: 'functional',
    label: 'Functional',
    description: 'Remember your preferences (language, theme, sidebar state).',
    required: false,
  },
  {
    id: 'analytics',
    label: 'Analytics',
    description: 'Help us understand how you use the app so we can improve it.',
    required: false,
  },
];

/**
 * Read saved consent from localStorage.
 * Returns null if no consent has been given yet.
 */
export function getConsent() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Check if a specific cookie category is consented to.
 */
export function hasConsent(category = 'essential') {
  const consent = getConsent();
  if (!consent) return category === 'essential'; // Essential is always allowed
  return consent.categories?.[category] === true;
}

/**
 * Save consent to localStorage.
 */
function saveConsent(categories) {
  const consent = {
    categories,
    timestamp: new Date().toISOString(),
    version: '1.0',
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
  // Dispatch custom event so other components can react
  window.dispatchEvent(new CustomEvent('cookie-consent-updated', { detail: consent }));
  return consent;
}

// ── Inline styles matching Circuit Canopy theme ────────────────────────────

const S = {
  overlay: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10000,
    background: 'rgba(8,25,22,0.95)',
    backdropFilter: 'blur(12px)',
    borderTop: '1px solid rgba(43,182,163,0.2)',
    boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
    padding: '24px 0',
    animation: 'slideUp 0.4s ease-out',
  },
  inner: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '0 24px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  icon: {
    fontSize: 20,
    lineHeight: 1,
  },
  title: {
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.08em',
    color: '#2BB6A3',
    textTransform: 'uppercase',
  },
  body: {
    color: '#A9C4BE',
    fontSize: 13,
    lineHeight: 1.6,
    marginBottom: 20,
    maxWidth: 700,
  },
  link: {
    color: '#EE6100',
    textDecoration: 'underline',
    textDecorationColor: 'rgba(238,97,0,0.4)',
    textUnderlineOffset: 2,
  },
  categories: {
    display: 'flex',
    gap: 12,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  categoryCard: (enabled, required) => ({
    flex: '1 1 200px',
    background: enabled ? 'rgba(43,182,163,0.08)' : 'rgba(15,38,32,0.6)',
    border: `1px solid ${enabled ? 'rgba(43,182,163,0.3)' : 'rgba(36,74,68,0.3)'}`,
    borderRadius: 8,
    padding: '12px 16px',
    cursor: required ? 'default' : 'pointer',
    opacity: required ? 0.7 : 1,
    transition: 'all 0.2s ease',
  }),
  catHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  catLabel: {
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.06em',
    color: '#F4F1EA',
    textTransform: 'uppercase',
  },
  catDesc: {
    fontSize: 11,
    color: '#6A8A82',
    lineHeight: 1.4,
  },
  toggle: (on, required) => ({
    width: 36,
    height: 20,
    borderRadius: 10,
    background: required ? 'rgba(43,182,163,0.4)' : on ? '#2BB6A3' : 'rgba(36,74,68,0.6)',
    border: 'none',
    cursor: required ? 'default' : 'pointer',
    position: 'relative',
    transition: 'background 0.2s ease',
    flexShrink: 0,
  }),
  toggleDot: (on) => ({
    position: 'absolute',
    top: 2,
    left: on ? 18 : 2,
    width: 16,
    height: 16,
    borderRadius: '50%',
    background: on ? '#fff' : '#6A8A82',
    transition: 'left 0.2s ease',
  }),
  actions: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  btn: (variant) => {
    const base = {
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      padding: '8px 20px',
      borderRadius: 6,
      border: 'none',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    };
    if (variant === 'primary') {
      return { ...base, background: '#EE6100', color: '#fff' };
    }
    if (variant === 'secondary') {
      return { ...base, background: 'rgba(43,182,163,0.15)', color: '#2BB6A3', border: '1px solid rgba(43,182,163,0.3)' };
    }
    if (variant === 'ghost') {
      return { ...base, background: 'transparent', color: '#6A8A82' };
    }
    return base;
  },
};

// ── Animation keyframe (injected once) ─────────────────────────────────────
const STYLE_ID = 'pcl-cookie-consent-styles';

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes slideUp {
      from { transform: translateY(100%); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    @media (max-width: 640px) {
      .pcl-cookie-categories { flex-direction: column !important; }
      .pcl-cookie-actions { flex-direction: column; align-items: stretch !important; }
      .pcl-cookie-actions button { width: 100%; text-align: center; }
    }
  `;
  document.head.appendChild(style);
}

// ── Main component ─────────────────────────────────────────────────────────

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [categories, setCategories] = useState({
    essential: true,
    functional: false,
    analytics: false,
  });
  const [reConsent, setReConsent] = useState(false);
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s._hydrated);

  // Only show cookie banner for public (unauthenticated) visitors
  useEffect(() => {
    // Don't act until Zustand has hydrated from localStorage —
    // otherwise user is always null on first render, causing a flash
    // of the banner for authenticated users.
    if (!hydrated) return;

    // Authenticated users don't see the banner — consent is assumed via login
    if (user) {
      setVisible(false);
      // Auto-grant essential + functional + analytics for logged-in users
      if (!getConsent()) {
        saveConsent({ essential: true, functional: true, analytics: true });
      }
      return;
    }

    injectStyles();
    const existing = getConsent();

    if (!existing) {
      // First time — show banner after delay
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }

    // Check if consent is older than 6 months → re-consent prompt
    const consentAge = Date.now() - new Date(existing.timestamp).getTime();
    if (consentAge > RECONSENT_INTERVAL_MS) {
      const timer = setTimeout(() => {
        setReConsent(true);
        setVisible(true);
      }, 2000);
      return () => clearTimeout(timer);
    }

    // Load saved preferences
    setCategories((prev) => ({
      ...prev,
      ...existing.categories,
      essential: true, // Always true
    }));
  }, [user, hydrated]);

  const toggleCategory = useCallback((id) => {
    if (id === 'essential') return; // Can't toggle essential
    setCategories((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleAcceptAll = useCallback(() => {
    const all = { essential: true, functional: true, analytics: true };
    setCategories(all);
    saveConsent(all);
    setVisible(false);
  }, []);

  const handleRejectOptional = useCallback(() => {
    const minimal = { essential: true, functional: false, analytics: false };
    setCategories(minimal);
    saveConsent(minimal);
    setVisible(false);
  }, []);

  const handleSavePreferences = useCallback(() => {
    saveConsent(categories);
    setVisible(false);
  }, [categories]);

  if (!visible) return null;

  return (
    <div style={S.overlay} role="dialog" aria-label="Cookie consent" aria-modal="false">
      <div style={S.inner}>
        {/* Header */}
        <div style={S.header}>
          <span style={S.icon}>🍪</span>
          <span style={S.title}>{reConsent ? 'Cookie Preferences — Review' : 'Cookie Preferences'}</span>
          {reConsent && (
            <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: '#FFB020', background: 'rgba(255,176,32,0.1)', border: '1px solid rgba(255,176,32,0.2)', borderRadius: 4, padding: '2px 8px', marginLeft: 8 }}>6 MONTHS</span>
          )}
        </div>

        {/* Description */}
        <p style={S.body}>
          {reConsent
            ? 'Your cookie preferences are over 6 months old. Please review and confirm your choices. You can keep your current settings or make changes.'
            : <>We use cookies to keep you logged in, remember your preferences, and understand how you use
          this app. You control which non-essential cookies are active.</>}
          {' '}
          <a href="/cookie-policy" style={S.link}>Cookie Policy</a>{' '}
          ·{' '}
          <a href="/legal" style={S.link}>Privacy Policy</a>
        </p>

        {/* Category cards */}
        <div className="pcl-cookie-categories" style={S.categories}>
          {CATEGORIES.map((cat) => (
            <div
              key={cat.id}
              style={S.categoryCard(categories[cat.id], cat.required)}
              onClick={() => !cat.required && toggleCategory(cat.id)}
              role={cat.required ? undefined : 'button'}
              tabIndex={cat.required ? undefined : 0}
              onKeyDown={(e) => {
                if (!cat.required && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  toggleCategory(cat.id);
                }
              }}
            >
              <div style={S.catHeader}>
                <span style={S.catLabel}>{cat.label}</span>
                {cat.required && (
                  <span style={{ fontSize: 9, color: '#6A8A82', fontFamily: "'Share Tech Mono', monospace" }}>
                    REQUIRED
                  </span>
                )}
                <div style={{ marginLeft: 'auto' }}>
                  <div style={S.toggle(categories[cat.id], cat.required)}>
                    <div style={S.toggleDot(categories[cat.id])} />
                  </div>
                </div>
              </div>
              <div style={S.catDesc}>{cat.description}</div>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="pcl-cookie-actions" style={S.actions}>
          <button style={S.btn('primary')} onClick={handleAcceptAll}>
            Accept All
          </button>
          <button style={S.btn('secondary')} onClick={handleSavePreferences}>
            Save Preferences
          </button>
          <button style={S.btn('ghost')} onClick={handleRejectOptional}>
            Reject Optional
          </button>
        </div>
      </div>
    </div>
  );
}
