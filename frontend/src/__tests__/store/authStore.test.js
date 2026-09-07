// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthStore } from '../../store/authStore';

// Reset store state between tests
beforeEach(() => {
  useAuthStore.setState({ user: null, loading: false, error: null });
  localStorage.clear();
});

describe('authStore', () => {
  test('initial state has null user and not loading', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.loading).toBe(false);
  });

  test('setUser updates user and sets loading to false', () => {
    const user = { _id: '1', name: 'Test', email: 'test@test.com', role: 'STAFF' };
    useAuthStore.getState().setUser(user);
    expect(useAuthStore.getState().user).toEqual(user);
    expect(useAuthStore.getState().loading).toBe(false);
  });

  test('logout clears user and loading state', () => {
    useAuthStore.getState().setUser({ _id: '1', name: 'Test' });
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().loading).toBe(false);
    expect(useAuthStore.getState().error).toBeNull();
  });

  test('clearError resets error to null', () => {
    useAuthStore.setState({ error: 'Some error' });
    useAuthStore.getState().clearError();
    expect(useAuthStore.getState().error).toBeNull();
  });

  test('initialize sets loading to false when no token', async () => {
    localStorage.removeItem('token');
    await useAuthStore.getState().initialize();
    expect(useAuthStore.getState().loading).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });

  test('store has login and logout methods', () => {
    expect(typeof useAuthStore.getState().login).toBe('function');
    expect(typeof useAuthStore.getState().logout).toBe('function');
  });
});

describe('useAuth backward-compatible hook', () => {
  test('exports useAuth function', async () => {
    const { useAuth } = await import('../../store/authStore');
    expect(typeof useAuth).toBe('function');
  });
});
