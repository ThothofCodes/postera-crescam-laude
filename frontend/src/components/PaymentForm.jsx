// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// PCL — PaymentForm with Socket.io real-time updates + polling fallback + cash fallback
import { useState, useEffect, useRef, useCallback } from 'react';
import { publicApi } from '../utils/api';
import { formatKES } from '../utils/helpers';
import { io } from 'socket.io-client';

const POLL_INTERVAL = 3000;
const MAX_POLL_ATTEMPTS = 30; // 90 seconds fallback
const MAX_RETRIES = 3;

// Always connect through the same origin so Vite/dev-server proxy handles /socket.io
const SOCKET_URL = import.meta.env.VITE_API_URL || window.location.origin;

export default function PaymentForm({ orderId, amount, onSuccess }) {
  const [status, setStatus] = useState('idle'); // idle | pushing | polling | success | failed | switching-cash
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [countdown, setCountdown] = useState(90);
  const [pollAttempts, setPollAttempts] = useState(0);
  const [usingSocket, setUsingSocket] = useState(false);

  const socketRef = useRef(null);
  const pollRef = useRef(null);
  const countdownRef = useRef(null);
  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (pollRef.current) clearTimeout(pollRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  // Countdown timer
  useEffect(() => {
    if (status === 'polling') {
      setCountdown(90);
      countdownRef.current = setInterval(() => {
        if (!mountedRef.current) return;
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(countdownRef.current);
    }
  }, [status]);

  // Connect to socket and watch for payment result
  const connectPaymentSocket = useCallback((checkoutRequestId) => {
    try {
      // Disconnect previous socket if any
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      const socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });

      socket.on('connect', () => {
        if (!mountedRef.current) return;
        console.log('[PAYMENT] Socket connected:', socket.id);
        setUsingSocket(true);
        // Join the payment room for this order
        socket.emit('payment:watch', checkoutRequestId);
      });

      socket.on('payment:result', (data) => {
        if (!mountedRef.current) return;
        console.log('[PAYMENT] Socket received:', data);
        clearInterval(countdownRef.current);
        clearTimeout(pollRef.current);

        if (data.success) {
          setStatus('success');
          onSuccess(data);
        } else {
          setStatus('failed');
          setError(data.message || 'Payment was not completed. Please try again.');
        }
      });

      socket.on('connect_error', (err) => {
        console.warn('[PAYMENT] Socket error, falling back to polling:', err.message);
        setUsingSocket(false);
      });

      socket.on('disconnect', () => {
        setUsingSocket(false);
      });

      socketRef.current = socket;
    } catch {
      // Socket setup failed — polling will handle it
      setUsingSocket(false);
    }
  }, [SOCKET_URL, onSuccess]);

  // Polling fallback (used when socket is not connected)
  const poll = useCallback(async (orderNumber, attempts = 0) => {
    if (!mountedRef.current) return;
    setPollAttempts(attempts);

    if (attempts >= MAX_POLL_ATTEMPTS) {
      clearInterval(countdownRef.current);
      setStatus('failed');
      setError('Payment timed out. The M-Pesa prompt may have expired. You can retry or pay at the counter.');
      return;
    }

    try {
      const { data } = await publicApi.get(`/orders/status/${orderNumber}`);
      if (data.paymentStatus === 'paid') {
        clearInterval(countdownRef.current);
        setStatus('success');
        onSuccess(data);
        return;
      }
    } catch {
      // network hiccup — keep polling
    }
    pollRef.current = setTimeout(() => poll(orderNumber, attempts + 1), POLL_INTERVAL);
  }, [onSuccess]);

  // Start payment — send STK push, then connect socket + fallback to polling
  const handlePay = useCallback(async () => {
    setStatus('pushing');
    setError('');
    setPollAttempts(0);

    try {
      // Explicitly send the STK push to Safaricom
      const { data: stkResult } = await publicApi.post(`/orders/pay/${orderId}`);
      const checkoutRequestId = stkResult.checkoutRequestId;

      if (!checkoutRequestId) {
        throw new Error('STK push did not return a checkout request ID');
      }

      // Try socket first
      connectPaymentSocket(checkoutRequestId);

      // Also start polling as fallback (socket might not connect)
      setStatus('polling');
      poll(stkResult.orderNumber || orderId);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to send M-Pesa prompt';
      setStatus('failed');
      setError(msg);
    }
  }, [orderId, connectPaymentSocket, poll]);

  // Retry STK push
  const handleRetry = useCallback(async () => {
    setStatus('pushing');
    setError('');
    try {
      const { data } = await publicApi.post(`/orders/retry-payment/${orderId}`);
      if (data.success) {
        setRetryCount(data.retryCount);
        // Reconnect socket with new checkoutRequestId
        connectPaymentSocket(data.checkoutRequestId);
        setStatus('polling');
        setPollAttempts(0);
        poll(orderId);
      } else {
        setStatus('failed');
        setError(data.message || 'Retry failed');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to retry payment';
      if (err.response?.status === 429) {
        setStatus('failed');
        setError(msg);
      } else {
        setStatus('failed');
        setError(msg);
      }
    }
  }, [orderId, connectPaymentSocket, poll]);

  // Switch to Cash on Pickup
  const handleSwitchToCash = useCallback(async () => {
    setStatus('switching-cash');
    setError('');
    try {
      const { data } = await publicApi.post(`/orders/switch-to-cash/${orderId}`);
      if (data.success) {
        setStatus('cash-success');
        // Notify parent of successful payment switch
        onSuccess({
          success: true,
          paymentMethod: 'cash',
          paymentStatus: 'pending_cash',
          orderNumber: data.orderNumber,
          amount: data.amount,
          message: data.message,
        });
      } else {
        setStatus('failed');
        setError(data.message || 'Failed to switch to cash payment');
      }
    } catch (err) {
      setStatus('failed');
      setError(err.response?.data?.message || 'Failed to switch payment method');
    }
  }, [orderId, onSuccess]);

  // ── Cash Success ──
  if (status === 'cash-success') {
    return (
      <div style={{ textAlign: 'center', padding: '1.5rem' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>💵</div>
        <p style={{ color: '#F59E0B', fontWeight: 700, fontSize: 20, margin: '0 0 4px' }}>Cash on Pickup Selected!</p>
        <p style={{ color: '#6A8A82', fontSize: 13, marginBottom: 8 }}>
          Pay <strong>{formatKES(amount)}</strong> when you collect your order
        </p>
        <div style={{
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
          borderRadius: 8, padding: '12px 16px', marginTop: 12,
        }}>
          <p style={{ color: '#F59E0B', fontSize: 13, margin: 0 }}>
            📍 Please bring your order number for verification at pickup
          </p>
        </div>
      </div>
    );
  }

  // ── Success ──
  if (status === 'success') {
    return (
      <div style={{ textAlign: 'center', padding: '1.5rem' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
        <p style={{ color: '#10b981', fontWeight: 700, fontSize: 20, margin: '0 0 4px' }}>Payment Confirmed!</p>
        <p style={{ color: '#6A8A82', fontSize: 13 }}>Thank you for your payment of {formatKES(amount)}</p>
      </div>
    );
  }

  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;
  const countdownStr = `${mins}:${String(secs).padStart(2, '0')}`;
  const canRetry = retryCount < MAX_RETRIES;
  const retriesLeft = MAX_RETRIES - retryCount;
  const maxRetriesReached = retryCount >= MAX_RETRIES;

  return (
    <div style={{ textAlign: 'center', padding: '1rem 0' }}>
      <p style={{ fontWeight: 700, fontSize: 20, color: '#E8F0EE', margin: '0 0 4px' }}>
        Pay {formatKES(amount)} via M-Pesa
      </p>

      {/* ── Idle ── */}
      {status === 'idle' && (
        <div>
          <p style={{ color: '#6A8A82', fontSize: 13, marginBottom: 16 }}>
            You'll receive an M-Pesa STK push prompt on your phone
          </p>
          <button onClick={handlePay}
            style={{
              padding: '0.75rem 2.5rem', background: '#16a34a', color: '#fff',
              border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 16, fontWeight: 700,
              transition: 'all 0.2s', fontFamily: "'Poppins', sans-serif",
            }}
            onMouseOver={(e) => { e.currentTarget.style.boxShadow = '0 0 20px rgba(22,163,74,0.4)'; }}
            onMouseOut={(e) => { e.currentTarget.style.boxShadow = 'none'; }}>
            📱 Send M-Pesa Prompt
          </button>
        </div>
      )}

      {/* ── Pushing ── */}
      {status === 'pushing' && (
        <div>
          <div style={{ display: 'inline-block', width: 28, height: 28, border: '3px solid #374151', borderTop: '3px solid #16a34a', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: 12 }} />
          <p style={{ color: '#9CA3AF', fontSize: 14 }}>Sending M-Pesa prompt...</p>
        </div>
      )}

      {/* ── Switching to Cash ── */}
      {status === 'switching-cash' && (
        <div>
          <div style={{ display: 'inline-block', width: 28, height: 28, border: '3px solid #374151', borderTop: '3px solid #F59E0B', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: 12 }} />
          <p style={{ color: '#9CA3AF', fontSize: 14 }}>Switching to Cash on Pickup...</p>
        </div>
      )}

      {/* ── Polling / Socket waiting ── */}
      {status === 'polling' && (
        <div>
          <div style={{
            background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.3)',
            borderRadius: 10, padding: '1.25rem', margin: '12px 0',
          }}>
            <p style={{ color: '#E8F0EE', fontWeight: 600, fontSize: 16, margin: '0 0 8px' }}>
              📱 Enter your M-Pesa PIN on your phone
            </p>
            <p style={{ color: '#6A8A82', fontSize: 13, margin: '0 0 12px' }}>
              Check for the STK push notification and enter your PIN
            </p>
            {/* Countdown */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <div style={{
                width: 60, height: 60, borderRadius: '50%',
                border: `3px solid ${countdown > 30 ? '#16a34a' : countdown > 10 ? '#F59E0B' : '#EF4444'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'border-color 0.3s',
              }}>
                <span style={{
                  fontFamily: "'Share Tech Mono', monospace", fontSize: 18, fontWeight: 700,
                  color: countdown > 30 ? '#16a34a' : countdown > 10 ? '#F59E0B' : '#EF4444',
                }}>
                  {countdownStr}
                </span>
              </div>
            </div>
            {/* Status indicator */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8 }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: usingSocket ? '#16a34a' : '#F59E0B',
                animation: 'breathe 2s ease-in-out infinite',
              }} />
              <span style={{ fontSize: 10, color: '#6A8A82', fontFamily: "'Share Tech Mono', monospace" }}>
                {usingSocket ? 'LIVE — Socket connected' : `POLLING — ${pollAttempts}/${MAX_POLL_ATTEMPTS}`}
              </span>
            </div>
          </div>
          <button onClick={() => {
            clearInterval(pollRef.current);
            clearInterval(countdownRef.current);
            if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
            setStatus('failed');
            setError('Payment cancelled.');
          }}
            style={{ padding: '0.5rem 1rem', background: 'transparent', color: '#6A8A82', border: '1px solid rgba(107,114,128,0.3)', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: "'Poppins', sans-serif" }}>
            Cancel
          </button>
        </div>
      )}

      {/* ── Failed ── */}
      {status === 'failed' && (
        <div>
          <div style={{
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 10, padding: '1rem', margin: '12px 0',
          }}>
            <p style={{ color: '#EF4444', fontWeight: 600, fontSize: 14, margin: '0 0 4px' }}>
              ⚠️ Payment Error
            </p>
            <p style={{ color: '#9CA3AF', fontSize: 13, margin: 0 }}>{error}</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16, alignItems: 'center' }}>
            {/* Retry M-Pesa Button */}
            {canRetry && (
              <button onClick={handleRetry}
                style={{
                  padding: '0.65rem 2rem', background: '#F59E0B', color: '#000',
                  border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700,
                  width: '100%', maxWidth: 320, fontFamily: "'Poppins', sans-serif",
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => { e.currentTarget.style.boxShadow = '0 0 16px rgba(245,158,11,0.3)'; }}
                onMouseOut={(e) => { e.currentTarget.style.boxShadow = 'none'; }}>
                🔄 Retry M-Pesa Prompt ({retriesLeft} {retriesLeft === 1 ? 'attempt' : 'attempts'} left)
              </button>
            )}

            {/* Switch to Cash Button — Always show, especially when retries exhausted */}
            <button onClick={handleSwitchToCash}
              style={{
                padding: '0.65rem 2rem',
                background: maxRetriesReached
                  ? 'linear-gradient(135deg, #16a34a, #22c55e)'
                  : 'rgba(22,163,74,0.15)',
                color: maxRetriesReached ? '#fff' : '#22c55e',
                border: maxRetriesReached ? 'none' : '1px solid rgba(22,163,74,0.3)',
                borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700,
                width: '100%', maxWidth: 320, fontFamily: "'Poppins', sans-serif",
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => { e.currentTarget.style.boxShadow = '0 0 16px rgba(22,163,74,0.3)'; }}
              onMouseOut={(e) => { e.currentTarget.style.boxShadow = 'none'; }}>
              💵 {maxRetriesReached ? 'Pay Cash on Pickup' : 'Switch to Cash on Pickup'}
            </button>

            {/* Start Over Button */}
            <button onClick={() => { setStatus('idle'); setError(''); setPollAttempts(0); setRetryCount(0); }}
              style={{
                padding: '0.5rem 1.5rem', background: 'transparent', color: '#6A8A82',
                border: '1px solid rgba(107,114,128,0.3)', borderRadius: 6, cursor: 'pointer',
                fontSize: 12, width: '100%', maxWidth: 320, fontFamily: "'Poppins', sans-serif",
              }}>
              📱 Start Over
            </button>

            {/* Max retries reached message */}
            {maxRetriesReached && (
              <div style={{
                background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
                borderRadius: 8, padding: '10px 14px', marginTop: 4, width: '100%', maxWidth: 320,
              }}>
                <p style={{ color: '#F59E0B', fontSize: 12, margin: 0, textAlign: 'center' }}>
                  ⚡ All M-Pesa retries exhausted. Choose Cash on Pickup or contact support.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes breathe {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}
