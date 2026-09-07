// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
import axios from 'axios';

// ── CSRF Token Helper ──────────────────────────────────────────────────────
// Reads the _csrf cookie (NOT httpOnly — frontend needs to read it for the header).
function getCsrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

// ── Fetch and store CSRF token from server ──────────────────────────────────
// Called once on app init. The server sets the _csrf cookie and returns the token.
export async function initCsrf() {
  try {
    await axios.get('/api/auth/csrf-token', { withCredentials: true });
  } catch (err) {
    console.warn('[CSRF] Failed to fetch CSRF token:', err.message);
  }
}

// ── Axios instances ─────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: '/api',
  timeout: 30000, // 30s timeout — prevents hanging requests
  withCredentials: true, // Send cookies (httpOnly JWT + CSRF) cross-origin
});

const publicApi = axios.create({
  baseURL: '/api',
  timeout: 30000,
  withCredentials: true,
});

// ── Content-Type handling (unchanged) ───────────────────────────────────────
function setContentTypeByPayload(config) {
  const isFormData = typeof FormData !== 'undefined' && config.data instanceof FormData;
  if (isFormData) {
    delete config.headers['Content-Type'];
  } else if (!config.headers['Content-Type']) {
    config.headers['Content-Type'] = 'application/json';
  }
  return config;
}

api.interceptors.request.use(setContentTypeByPayload);
publicApi.interceptors.request.use(setContentTypeByPayload);

// CSRF on publicApi too — payment endpoints need it
publicApi.interceptors.request.use(
  (config) => {
    const method = (config.method || 'get').toLowerCase();
    if (['post', 'put', 'patch', 'delete'].includes(method)) {
      const csrfToken = getCsrfToken();
      if (csrfToken) config.headers['X-CSRF-Token'] = csrfToken;
    }
    return config;
  },
  (err) => Promise.reject(err)
);

// ── Request interceptor — attach CSRF token on mutations ────────────────────
api.interceptors.request.use(
  (config) => {
    // Attach CSRF token on state-changing requests (POST, PUT, PATCH, DELETE)
    const method = (config.method || 'get').toLowerCase();
    if (['post', 'put', 'patch', 'delete'].includes(method)) {
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
      }
    }

    // Attach admin token from localStorage (admin auth uses separate store)
    // Regular user JWT is in httpOnly cookie — sent automatically via withCredentials
    // Skip on login/register endpoints to avoid stale token causing 403
    const isAdminEndpoint = (config.url || '').includes('/auth/login') || (config.url || '').includes('/auth/register');
    if (!isAdminEndpoint) {
      const adminToken = localStorage.getItem('adminToken');
      if (adminToken) {
        if (typeof adminToken === 'string' && adminToken.split('.').length === 3) {
          config.headers.Authorization = `Bearer ${adminToken}`;
        } else {
          localStorage.removeItem('adminToken');
        }
      }
    }

    return config;
  },
  (err) => Promise.reject(err)
);

// ── Response interceptor — handle auth errors ──────────────────────────────
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const data = err.response?.data || {};

      // Session killed by another login or idle timeout — show specific message
      if (data.code === 'SESSION_KILLED' || data.code === 'SESSION_IDLE_TIMEOUT') {
        const wasAuthenticated = !!localStorage.getItem('adminToken') || !!localStorage.getItem('pcl-admin-auth');
        localStorage.removeItem('adminToken');
        localStorage.removeItem('pcl-admin-auth');
        sessionStorage.clear();

        // Only redirect if user was actually logged in
        if (wasAuthenticated) {
          const reason = data.code === 'SESSION_IDLE_TIMEOUT' ? 'idle_timeout' : 'session_killed';
          const msg = encodeURIComponent(data.message || 'Your session has expired.');
          window.location.href = `/admin/login?reason=${reason}&msg=${msg}`;
        }
        return Promise.reject(err);
      }

      // Don't redirect on session check calls — let the store handle cleanup
      const isSessionCheck = (err.config?.url || '').includes('/auth/me');
      if (!isSessionCheck) {
        // Token expired or invalid — only redirect if user was previously authenticated
        const hadAdminToken = !!localStorage.getItem('adminToken') || !!localStorage.getItem('pcl-admin-auth');
        localStorage.removeItem('adminToken');
        localStorage.removeItem('pcl-admin-auth');
        // Only redirect if the user WAS logged in (had a token) and is not on a public page
        if (hadAdminToken && !window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(err);
  }
);

// ── CSRF error handler — auto-refresh CSRF token on 403 ────────────────────
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 403 && err.response?.data?.code?.startsWith('CSRF')) {
      // CSRF token expired or missing — refresh and retry once
      try {
        await initCsrf();
        const csrfToken = getCsrfToken();
        if (csrfToken && err.config) {
          err.config.headers['X-CSRF-Token'] = csrfToken;
          return api.request(err.config);
        }
      } catch {
        // Retry failed — fall through to login redirect
      }
    }
    return Promise.reject(err);
  }
);

export { api, publicApi };
