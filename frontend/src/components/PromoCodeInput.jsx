// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// PCL — Promo Code input for checkout flow.
// Validates promo codes against the monetization API and applies discounts.

import { useState, useCallback } from 'react';
import { api } from '../utils/api';

const S = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  row: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 13,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    padding: '8px 12px',
    background: 'rgba(8,25,22,0.8)',
    border: '1px solid rgba(36,74,68,0.4)',
    borderRadius: 6,
    color: '#F4F1EA',
    outline: 'none',
  },
  applyBtn: {
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    padding: '8px 16px',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    background: '#EE6100',
    color: '#fff',
    whiteSpace: 'nowrap',
  },
  removeBtn: {
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 10,
    color: '#FF3B3B',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
  },
  success: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    color: '#39FF88',
    fontFamily: "'Share Tech Mono', monospace",
  },
  error: {
    fontSize: 12,
    color: '#FF3B3B',
    fontFamily: "'Share Tech Mono', monospace",
  },
  discount: {
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 13,
    fontWeight: 700,
    color: '#39FF88',
  },
};

/**
 * Promo code input for checkout.
 *
 * @param {number} orderAmount - Current order total for discount calculation
 * @param {string} itemType - Type of item ('products', 'services', etc.)
 * @param {function} onApply - Callback when promo is applied: (discount, code) => void
 * @param {function} onRemove - Callback when promo is removed: () => void
 * @param {object} appliedPromo - Currently applied promo (if any)
 */
export default function PromoCodeInput({ orderAmount = 0, itemType = 'all', onApply, onRemove, appliedPromo }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleApply = useCallback(async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError('');

    try {
      const { data } = await api.post('/monetization/promos/validate', {
        code: code.trim(),
        orderAmount,
        itemType,
      });

      if (data.valid) {
        onApply?.(data.discount, data);
        setCode('');
      } else {
        setError(data.message || 'Invalid promo code');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to validate promo code');
    }
    setLoading(false);
  }, [code, orderAmount, itemType, onApply]);

  const handleRemove = useCallback(() => {
    setCode('');
    setError('');
    onRemove?.();
  }, [onRemove]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleApply();
    }
  }, [handleApply]);

  // Show applied promo
  if (appliedPromo) {
    return (
      <div style={S.wrapper}>
        <div style={S.row}>
          <div style={S.success}>
            ✅ <span style={{ textTransform: 'uppercase' }}>{appliedPromo.code}</span> applied
            {appliedPromo.discount > 0 && (
              <span style={S.discount}> − KES {appliedPromo.discount.toLocaleString()}</span>
            )}
            {appliedPromo.freeShipping && (
              <span style={{ color: '#2BB6A3' }}> + Free Shipping</span>
            )}
          </div>
          <button style={S.removeBtn} onClick={handleRemove}>✕ Remove</button>
        </div>
      </div>
    );
  }

  return (
    <div style={S.wrapper}>
      <div style={S.row}>
        <input
          type="text"
          placeholder="Promo code"
          value={code}
          onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(''); }}
          onKeyDown={handleKeyDown}
          style={S.input}
          disabled={loading}
        />
        <button
          style={{ ...S.applyBtn, opacity: loading || !code.trim() ? 0.5 : 1 }}
          onClick={handleApply}
          disabled={loading || !code.trim()}
        >
          {loading ? '...' : 'Apply'}
        </button>
      </div>
      {error && <div style={S.error}>⚠ {error}</div>}
    </div>
  );
}
