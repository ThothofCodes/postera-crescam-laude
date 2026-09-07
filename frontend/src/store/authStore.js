// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// Zustand auth store — replaces AuthContext with selector-based re-renders.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../utils/api';
import { setSocketAuthToken } from '../hooks/useSocket';

// Backward-compatible hook that matches old AuthContext API
export const useAuth = () => {
  const { user, loading, login, logout } = useAuthStore();
  return { user, loading, login, logout };
};

export const useAuthStore = create(
  persist(
    (set, get) => ({
      // State
      user: null,
      loading: true,
      error: null,
      _hydrated: false,

      // Actions
      setUser: (user) => set({ user, loading: false, error: null }),

      login: async (email, password) => {
        set({ loading: true, error: null });
        try {
          // Get device fingerprint for auto-registration
          let deviceFingerprint = null;
          let deviceName = null;
          try {
            const { getDeviceFingerprint, getDeviceDescription } = await import('../utils/deviceFingerprint');
            deviceFingerprint = await getDeviceFingerprint();
            deviceName = getDeviceDescription();
          } catch (err) {
            console.warn('[AuthStore] Could not get device fingerprint:', err.message);
          }

          const { data } = await api.post('/auth/login', {
            email,
            password,
            ...(deviceFingerprint && { deviceFingerprint, deviceName }),
          });
          // JWT is in httpOnly cookie for API calls (XSS protection)
          // Token in response body is stored in-memory only for Socket.IO auth
          if (data.token) setSocketAuthToken(data.token);

          // Clear admin auth store to prevent dual sessions
          localStorage.removeItem('adminToken');
          localStorage.removeItem('pcl-admin-auth');
          try { (await import('../store/adminStore')).useAdminAuth.setState({ user: null, adminToken: null, loading: false }); } catch {}

          // Fetch full user from DB
          const me = await api.get('/auth/me');
          set({ user: me.data, loading: false });
          return me.data;
        } catch (err) {
          const message = err.response?.data?.message || 'Login failed';
          set({ loading: false, error: message });
          throw err;
        }
      },

      logout: () => {
        // Clear httpOnly cookie via server endpoint
        api.post('/auth/logout').catch(() => {});
        set({ user: null, loading: false, error: null });
      },

      // Initialize — called once on app mount to check existing token
      initialize: async () => {
        // Wait for persist hydration before checking localStorage
        if (!get()._hydrated) {
          await new Promise((resolve) => {
            const check = setInterval(() => {
              if (get()._hydrated) { clearInterval(check); resolve(); }
            }, 50);
            setTimeout(() => { clearInterval(check); resolve(); }, 2000);
          });
        }

        // If admin token exists, skip regular auth init entirely — prevent dual sessions
        if (localStorage.getItem('adminToken') || localStorage.getItem('pcl-admin-auth')) {
          set({ user: null, loading: false });
          return;
        }

        // Only check /auth/me if there's evidence of an existing session
        // (persisted user state or pcl-auth cookie) to avoid SESSION_KILLED redirect on public pages
        const hasPersistedUser = !!get().user;
        if (!hasPersistedUser) {
          set({ user: null, loading: false });
          return;
        }

        // JWT is in httpOnly cookie — verify existing session is still valid
        try {
          const { data } = await api.get('/auth/me');
          set({ user: data, loading: false });
        } catch {
          // No valid session cookie — user is not logged in
          set({ user: null, loading: false });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'pcl-auth',
      partialize: (state) => ({ user: state.user }),
      onRehydrateStorage: () => () => {
        useAuthStore.setState({ _hydrated: true });
      },
    }
  )
);
