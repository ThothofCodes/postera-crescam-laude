// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// PCL — Admin Auth Store with device fingerprinting and session management
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../utils/api';
import { getDeviceFingerprint, getDeviceDescription } from '../utils/deviceFingerprint';

export const useAdminAuth = create(
  persist(
    (set, get) => ({
      user: null,
      adminToken: null,
      loading: true,
      sessionKilled: false,

      // Login with device fingerprinting for auto-registration
      login: async (email, password) => {
        console.log('[AdminStore] Login called with:', email);
        try {
          // Get device fingerprint for auto-registration
          let deviceFingerprint = null;
          let deviceName = null;
          try {
            deviceFingerprint = await getDeviceFingerprint();
            deviceName = getDeviceDescription();
          } catch (err) {
            console.warn('[AdminStore] Could not get device fingerprint:', err.message);
          }

          const { data } = await api.post('/auth/login', {
            email,
            password,
            ...(deviceFingerprint && { deviceFingerprint, deviceName }),
          });

          console.log('[AdminStore] Login success:', data.user?.role, 'token length:', data.token?.length);

          // Clear regular auth store to prevent dual sessions
          localStorage.removeItem('token');
          localStorage.removeItem('pcl-auth');
          try { (await import('../store/authStore')).useAuthStore.setState({ user: null, loading: false }); } catch {}

          // Sync to standalone localStorage keys so the API interceptor can read them
          if (data.token) localStorage.setItem('adminToken', data.token);

          set({
            user: { ...data.user, mustChangePassword: data.mustChangePassword || false },
            adminToken: data.token,
            sessionKilled: false,
          });

          return data;
        } catch (err) {
          console.error('[AdminStore] Login error:', err.message, err.response?.data);
          throw err;
        }
      },

      // Logout
      logout: async () => {
        try {
          if (get().adminToken) {
            await api.post('/auth/logout').catch(() => {});
          }
        } finally {
          localStorage.removeItem('adminToken');
          set({ user: null, adminToken: null, sessionKilled: false });
        }
      },

      // Check session validity
      checkSession: async () => {
        try {
          const token = get().adminToken;
          if (!token) {
            set({ loading: false });
            return;
          }

          const { data } = await api.get('/auth/me');
          set({ user: data, loading: false });
        } catch (err) {
          if (err.response?.status === 401 && err.response?.data?.code === 'SESSION_KILLED') {
            localStorage.removeItem('adminToken');
            localStorage.removeItem('pcl-admin-auth');
            set({ sessionKilled: true, user: null, adminToken: null, loading: false });
          } else if (err.response?.status === 401) {
            localStorage.removeItem('adminToken');
            localStorage.removeItem('pcl-admin-auth');
            set({ user: null, adminToken: null, loading: false });
          } else {
            // Non-auth error (network, etc.) — don't clear token, just stop loading
            set({ loading: false });
          }
        }
      },

      // Initialize: check session on app load
      init: async () => {
        const token = get().adminToken;
        if (!token) {
          set({ loading: false });
          return;
        }
        await get().checkSession();
      },

      // Note: isSuperAdmin and isDeptHead are computed in the components
      // that use them, not as store getters (Zustand getters aren't reactive).
    }),
    {
      name: 'pcl-admin-auth',
      partialize: (state) => ({
        adminToken: state.adminToken,
        user: state.user,
      }),
    }
  )
);

// ── Legacy export alias ──────────────────────────────────────────────
export const useAdminStore = useAdminAuth;

// ── Permission helpers ───────────────────────────────────────────────
export const getPermissions = (role) => {
  const base = { canManageUsers: false, canViewReports: false, canManageInventory: false, canManageBilling: false };
  switch (role) {
    case 'SUPER_ADMIN':
      return { ...base, canManageUsers: true, canViewReports: true, canManageInventory: true, canManageBilling: true };
    case 'DEPT_HEAD_OWNER':
      return { ...base, canViewReports: true, canManageInventory: true, canManageBilling: true };
    case 'STAFF':
      return { ...base, canViewReports: true };
    default:
      return base;
  }
};

// ── Initialize function (called on app load) ─────────────────────────
// Syncs the Zustand-persisted token to the standalone localStorage key
// that the API interceptor reads. Also clears regular auth to prevent dual sessions.
export const initializeAdminAuth = async () => {
  const { adminToken } = useAdminAuth.getState();
  if (adminToken) {
    // Ensure standalone key exists for the API interceptor
    if (!localStorage.getItem('adminToken')) {
      localStorage.setItem('adminToken', adminToken);
    }

    // Clear regular auth store to prevent dual sessions
    localStorage.removeItem('token');
    localStorage.removeItem('pcl-auth');
    try { (await import('./authStore')).useAuthStore.setState({ user: null, loading: false }); } catch {}

    await useAdminAuth.getState().checkSession();
  } else {
    useAdminAuth.setState({ loading: false });
  }
};
