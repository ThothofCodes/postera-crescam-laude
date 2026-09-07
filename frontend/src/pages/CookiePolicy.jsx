// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// PCL — Cookie Policy Page
// Explains what cookies the app uses, why, and how to manage them.
// Links from the CookieConsent banner.

import { useNavigate } from 'react-router-dom';

// ── Cookie categories with full details ────────────────────────────────────

const COOKIE_CATEGORIES = [
  {
    id: 'essential',
    label: 'Essential Cookies',
    required: true,
    color: '#39FF88',
    cookies: [
      {
        name: 'pcl_token',
        purpose: 'Stores your JWT authentication token. Keeps you logged in across page refreshes.',
        type: 'httpOnly',
        duration: '8 hours',
        provider: 'PCL Application',
      },
      {
        name: '_csrf',
        purpose: 'CSRF protection token. Prevents cross-site request forgery attacks on forms and mutations.',
        type: 'Readable by JavaScript',
        duration: '1 hour',
        provider: 'PCL Application',
      },
      {
        name: 'pcl_cookie_consent',
        purpose: 'Stores your cookie consent preferences so the banner doesn\'t reappear.',
        type: 'localStorage',
        duration: 'Until cleared',
        provider: 'PCL Application',
      },
    ],
  },
  {
    id: 'functional',
    label: 'Functional Cookies',
    required: false,
    color: '#2BB6A3',
    cookies: [
      {
        name: 'pcl_sidebar_state',
        purpose: 'Remembers whether the admin sidebar is collapsed or expanded.',
        type: 'localStorage',
        duration: 'Until cleared',
        provider: 'PCL Application',
      },
      {
        name: 'pcl_theme',
        purpose: 'Stores your theme preference (dark/light mode).',
        type: 'localStorage',
        duration: 'Until cleared',
        provider: 'PCL Application',
      },
      {
        name: 'pcl_language',
        purpose: 'Remembers your preferred language for the interface.',
        type: 'localStorage',
        duration: 'Until cleared',
        provider: 'PCL Application',
      },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics Cookies',
    required: false,
    color: '#EE6100',
    cookies: [
      {
        name: 'pcl_session_id',
        purpose: 'Anonymous session identifier for understanding how users navigate the app.',
        type: 'localStorage',
        duration: '30 days',
        provider: 'PCL Application',
      },
      {
        name: 'pcl_feature_flags',
        purpose: 'Tracks which beta features you\'ve been enrolled in for A/B testing.',
        type: 'localStorage',
        duration: '90 days',
        provider: 'PCL Application',
      },
    ],
  },
];

// ── Inline styles (Circuit Canopy theme) ───────────────────────────────────

const S = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg-main, #081916)',
    color: 'var(--text-primary, #F4F1EA)',
    fontFamily: 'var(--font-body, "Poppins", system-ui, sans-serif)',
    padding: '0 24px',
  },
  container: {
    maxWidth: 800,
    margin: '0 auto',
    padding: '60px 0 80px',
  },
  backBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    color: 'var(--text-secondary, #A9C4BE)',
    fontSize: 13,
    fontFamily: "'Share Tech Mono', monospace",
    textDecoration: 'none',
    marginBottom: 32,
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    padding: 0,
  },
  title: {
    fontFamily: "'Rajdhani', 'Poppins', system-ui, sans-serif",
    fontSize: 32,
    fontWeight: 700,
    color: 'var(--text-primary, #F4F1EA)',
    marginBottom: 8,
    lineHeight: 1.2,
  },
  subtitle: {
    fontSize: 14,
    color: 'var(--text-secondary, #A9C4BE)',
    marginBottom: 40,
    lineHeight: 1.6,
  },
  lastUpdated: {
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 11,
    color: 'var(--text-muted, #6A8A82)',
    letterSpacing: '0.05em',
    marginBottom: 40,
  },
  section: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontFamily: "'Rajdhani', 'Poppins', system-ui, sans-serif",
    fontSize: 20,
    fontWeight: 700,
    color: 'var(--color-teal-bright, #2BB6A3)',
    marginBottom: 12,
  },
  body: {
    fontSize: 14,
    lineHeight: 1.7,
    color: 'var(--text-secondary, #A9C4BE)',
    marginBottom: 16,
  },
  categoryCard: (color) => ({
    background: 'var(--bg-surface, #0F2620)',
    border: `1px solid ${color}33`,
    borderRadius: 10,
    padding: 24,
    marginBottom: 20,
  }),
  categoryHeader: (color) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  }),
  categoryDot: (color) => ({
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: color,
    flexShrink: 0,
  }),
  categoryLabel: {
    fontFamily: "'Rajdhani', 'Poppins', system-ui, sans-serif",
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--text-primary, #F4F1EA)',
  },
  requiredBadge: {
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.08em',
    color: '#39FF88',
    background: 'rgba(57,255,136,0.1)',
    border: '1px solid rgba(57,255,136,0.2)',
    borderRadius: 4,
    padding: '2px 8px',
  },
  cookieTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },
  th: {
    textAlign: 'left',
    padding: '8px 12px',
    borderBottom: '1px solid var(--border-default, rgba(36,74,68,0.4))',
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.08em',
    color: 'var(--text-muted, #6A8A82)',
    textTransform: 'uppercase',
  },
  td: {
    padding: '10px 12px',
    borderBottom: '1px solid var(--border-light, rgba(36,74,68,0.2))',
    color: 'var(--text-secondary, #A9C4BE)',
    lineHeight: 1.5,
    verticalAlign: 'top',
  },
  cookieName: {
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 12,
    color: 'var(--color-teal-bright, #2BB6A3)',
    background: 'rgba(43,182,163,0.08)',
    padding: '2px 6px',
    borderRadius: 3,
  },
  badge: (color) => ({
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 10,
    letterSpacing: '0.05em',
    color,
    background: `${color}15`,
    border: `1px solid ${color}30`,
    borderRadius: 4,
    padding: '2px 6px',
    whiteSpace: 'nowrap',
  }),
  manageBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#fff',
    background: 'var(--color-primary, #EE6100)',
    border: 'none',
    borderRadius: 8,
    padding: '12px 24px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
};

// ── Component ──────────────────────────────────────────────────────────────

export default function CookiePolicy() {
  const navigate = useNavigate();

  const handleManageCookies = () => {
    // Clear saved consent to force the banner to reappear
    localStorage.removeItem('pcl_cookie_consent');
    window.dispatchEvent(new CustomEvent('cookie-consent-updated', { detail: null }));
    navigate('/');
  };

  return (
    <div style={S.page}>
      <div style={S.container}>
        {/* Back button */}
        <button style={S.backBtn} onClick={() => navigate(-1)}>
          ← Back
        </button>

        {/* Header */}
        <h1 style={S.title}>Cookie Policy</h1>
        <p style={S.lastUpdated}>Last updated: September 2026</p>
        <p style={S.subtitle}>
          This page explains what cookies and similar technologies the PCL application uses,
          why we use them, and how you can control them.
        </p>

        {/* What are cookies */}
        <div style={S.section}>
          <h2 style={S.sectionTitle}>What Are Cookies?</h2>
          <p style={S.body}>
            Cookies are small text files placed on your device when you visit a website.
            They help the site remember your actions and preferences over time, so you
            don&apos;t have to re-enter them every time you visit. The PCL application uses
            cookies and browser localStorage for similar purposes.
          </p>
        </div>

        {/* How we use cookies */}
        <div style={S.section}>
          <h2 style={S.sectionTitle}>How We Use Cookies</h2>
          <p style={S.body}>
            We use cookies to keep you logged in, remember your preferences, protect
            against security threats, and understand how you use the application.
            We never use cookies to personally identify you or sell your data.
          </p>
        </div>

        {/* Cookie categories */}
        <div style={S.section}>
          <h2 style={S.sectionTitle}>Cookie Categories</h2>
          {COOKIE_CATEGORIES.map((category) => (
            <div key={category.id} style={S.categoryCard(category.color)}>
              <div style={S.categoryHeader(category.color)}>
                <div style={S.categoryDot(category.color)} />
                <span style={S.categoryLabel}>{category.label}</span>
                {category.required && <span style={S.requiredBadge}>REQUIRED</span>}
              </div>

              <table style={S.cookieTable}>
                <thead>
                  <tr>
                    <th style={S.th}>Cookie</th>
                    <th style={S.th}>Purpose</th>
                    <th style={S.th}>Type</th>
                    <th style={S.th}>Duration</th>
                    <th style={S.th}>Provider</th>
                  </tr>
                </thead>
                <tbody>
                  {category.cookies.map((cookie) => (
                    <tr key={cookie.name}>
                      <td style={S.td}>
                        <span style={S.cookieName}>{cookie.name}</span>
                      </td>
                      <td style={S.td}>{cookie.purpose}</td>
                      <td style={S.td}>
                        <span style={S.badge(category.color)}>{cookie.type}</span>
                      </td>
                      <td style={S.td}>{cookie.duration}</td>
                      <td style={S.td}>{cookie.provider}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        {/* Third-party cookies */}
        <div style={S.section}>
          <h2 style={S.sectionTitle}>Third-Party Cookies</h2>
          <p style={S.body}>
            The PCL application does <strong style={{ color: 'var(--text-primary, #F4F1EA)' }}>not</strong> use
            third-party tracking cookies. All cookies are set directly by our application.
            We do not embed external analytics scripts (Google Analytics, Facebook Pixel, etc.)
            that would set their own cookies.
          </p>
        </div>

        {/* LocalStorage */}
        <div style={S.section}>
          <h2 style={S.sectionTitle}>Browser localStorage</h2>
          <p style={S.body}>
            In addition to cookies, the application uses browser localStorage to store:
          </p>
          <ul style={{ ...S.body, paddingLeft: 20 }}>
            <li><strong style={{ color: 'var(--text-primary, #F4F1EA)' }}>Authentication tokens</strong> — Your login session (httpOnly cookie is primary; localStorage is a fallback)</li>
            <li><strong style={{ color: 'var(--text-primary, #F4F1EA)' }}>UI preferences</strong> — Sidebar state, theme, language</li>
            <li><strong style={{ color: 'var(--text-primary, #F4F1EA)' }}>Consent record</strong> — Your cookie preferences</li>
            <li><strong style={{ color: 'var(--text-primary, #F4F1EA)' }}>CSRF tokens</strong> — Cross-site request forgery protection</li>
          </ul>
          <p style={S.body}>
            localStorage data stays on your device and is never sent to external servers.
            You can clear it by logging out or using your browser&apos;s developer tools.
          </p>
        </div>

        {/* Managing cookies */}
        <div style={S.section}>
          <h2 style={S.sectionTitle}>Managing Your Cookie Preferences</h2>
          <p style={S.body}>
            You can change your cookie preferences at any time by clicking the button below.
            This will reopen the cookie consent banner where you can accept, reject, or
            customize which cookie categories are active.
          </p>
          <button style={S.manageBtn} onClick={ManageCookies}>
            🍪 Manage Cookie Preferences
          </button>
        </div>

        {/* Browser settings */}
        <div style={S.section}>
          <h2 style={S.sectionTitle}>Browser Cookie Settings</h2>
          <p style={S.body}>
            You can also control cookies through your browser settings. Most browsers allow
            you to block or delete cookies. Note that blocking essential cookies may prevent
            the application from working correctly — you won&apos;t be able to log in.
          </p>
          <p style={S.body}>
            For instructions on managing cookies in your browser:
          </p>
          <ul style={{ ...S.body, paddingLeft: 20 }}>
            <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary, #EE6100)', textDecoration: 'underline', textUnderlineOffset: 2 }}>Google Chrome</a></li>
            <li><a href="https://support.mozilla.org/en-US/kb/enhanced-tracking-protection-firefox-desktop" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary, #EE6100)', textDecoration: 'underline', textUnderlineOffset: 2 }}>Mozilla Firefox</a></li>
            <li><a href="https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary, #EE6100)', textDecoration: 'underline', textUnderlineOffset: 2 }}>Apple Safari</a></li>
            <li><a href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary, #EE6100)', textDecoration: 'underline', textUnderlineOffset: 2 }}>Microsoft Edge</a></li>
          </ul>
        </div>

        {/* Contact */}
        <div style={S.section}>
          <h2 style={S.sectionTitle}>Questions?</h2>
          <p style={S.body}>
            If you have questions about our cookie practices, contact us at{' '}
            <a href="mailto:support@pcl.co.ke" style={{ color: 'var(--color-primary, #EE6100)', textDecoration: 'underline', textUnderlineOffset: 2 }}>
              support@pcl.co.ke
            </a>.
          </p>
        </div>
      </div>
    </div>
  );
}

function ManageCookies() {
  localStorage.removeItem('pcl_cookie_consent');
  window.dispatchEvent(new CustomEvent('cookie-consent-updated', { detail: null }));
  window.location.reload();
}
