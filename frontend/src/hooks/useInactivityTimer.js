// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// ── Inactivity Timer Hook ───────────────────────────────────────────────
// Resets on mouse, keyboard, touch, or scroll events.
// When the idle timeout fires, calls onLogout to force sign-out.
//
// Usage:
//   useInactivityTimer(onLogout, 30 * 60 * 1000); // 30 min default

import { useEffect, useRef } from 'react';

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'];

export default function useInactivityTimer(onLogout, timeoutMs = 30 * 60 * 1000) {
  const timerRef = useRef(null);
  const onLogoutRef = useRef(onLogout);
  onLogoutRef.current = onLogout;

  useEffect(() => {
    if (!onLogout || timeoutMs <= 0) return;

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        console.warn(`[InactivityTimer] Idle for ${Math.round(timeoutMs / 1000)}s — logging out`);
        onLogoutRef.current();
      }, timeoutMs);
    };

    // Start the timer
    resetTimer();

    // Listen for user activity
    ACTIVITY_EVENTS.forEach((event) => {
      document.addEventListener(event, resetTimer, { passive: true });
    });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((event) => {
        document.removeEventListener(event, resetTimer);
      });
    };
  }, [onLogout, timeoutMs]);
}
