// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
import { useEffect, useRef } from 'react';
import io from 'socket.io-client';

let socket;
let socketToken; // tracks which token the live `socket` singleton was built with

// In-memory token for Socket.IO auth (never persisted to localStorage)
let _socketAuthToken = null;
export function setSocketAuthToken(token) { _socketAuthToken = token; }
export function getSocketAuthToken() { return _socketAuthToken; }

export const useSocket = (eventHandlers = {}) => {
  const token = _socketAuthToken || localStorage.getItem('adminToken');
  const handlersRef = useRef(eventHandlers);

  // Update handlers ref when eventHandlers change
  useEffect(() => {
    handlersRef.current = eventHandlers;
  }, [eventHandlers]);
  
  useEffect(() => {
    try {
      // Connect to socket with authentication
      // When tunneled, derive backend URL from current page origin
      // (both frontend and backend are served from the same tunnel)
      // Always connect through the same origin so Vite/dev-server proxy handles /socket.io
      const BACKEND_URL = import.meta.env.VITE_API_URL || window.location.origin;

      // FIX (Continuity Audit, Part One, Exhibit A): the auth payload used to
      // be sent as `Bearer ${token}`. Socket.IO's `auth` field is not an HTTP
      // header — the server expects the raw token — so every admin socket
      // failed jwt.verify() with "jwt malformed" and was silently demoted to
      // an anonymous visitor. Send the raw token, matching what useChat.js
      // (and the server) actually expect.
      //
      // Also: `socket` is a module-level singleton, so if it was created once
      // (e.g. logged out, or logged in as someone else) it would silently
      // keep using the OLD token forever. Since whoever holds the live socket
      // determines this app's notion of "who's online," a stale token here
      // is a real identity/clearance bug, not just a staleness annoyance —
      // so rebuild the connection whenever the token actually changes.
      if (socket && socketToken !== token) {
        socket.disconnect();
        socket = undefined;
      }

      if (!socket) {
        socket = io(BACKEND_URL, {
          auth: { token: token || undefined },
          transports: ['websocket', 'polling'],
          timeout: 10000, // 10 second timeout
          autoConnect: true
        });
        socketToken = token;

        // Handle connection events
        socket.on('connect', () => {
          console.log('[SOCKET] Connected:', socket.id);
        });

        socket.on('disconnect', (reason) => {
          console.log('[SOCKET] Disconnected:', reason);
        });
        
        // Handle connection errors
        socket.on('connect_error', (error) => {
          console.error('[SOCKET] Connection error:', error);
        });
      }

      // Register event handlers if provided
      Object.entries(handlersRef.current).forEach(([event, handler]) => {
        if (typeof handler === 'function' && socket) {
          socket.on(event, handler);
        }
      });

      // Clean up listeners on unmount
      return () => {
        Object.entries(handlersRef.current).forEach(([event, handler]) => {
          if (typeof handler === 'function' && socket) {
            socket.off(event, handler);
          }
        });
      };
    } catch (error) {
      console.error('[SOCKET] Error initializing socket:', error);
    }
  }, [token]);

  // Return socket instance (or a safe stub if not yet initialised)
  return socket || { emit: () => {}, on: () => {}, off: () => {}, connected: false };
};

// Export as default for backward compatibility
export default useSocket;