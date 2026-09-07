// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// Share Meeting Modal — Copy link, send email/SMS invites

import React, { useState } from 'react';

const COLORS = {
  primary: '#FF6B00',
  accent: '#00C7B7',
  bg: '#111827',
  surface: '#1F2937',
  surfaceHover: '#374151',
  text: '#F9FAFB',
  muted: '#9CA3AF',
  danger: '#EF4444',
  success: '#10B981',
};

const api = {
  get: (url) => fetch(url, { credentials: 'include' }).then((r) => r.json()),
  post: (url, data) => fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then((r) => r.json()),
};

export default function ShareMeetingModal({ open, onClose, room }) {
  const [tab, setTab] = useState('link');
  const [copied, setCopied] = useState(false);
  const [emails, setEmails] = useState('');
  const [phones, setPhones] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  if (!open || !room) return null;

  const joinUrl = `${window.location.origin}/admin/meetings?join=${room._id}`;
  const scheduledStr = room.scheduledAt
    ? new Date(room.scheduledAt).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })
    : 'Starting now';

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = joinUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Meeting: ${room.title}`,
          text: `You're invited to ${room.title} (${scheduledStr})`,
          url: joinUrl,
        });
      } catch { /* user cancelled */ }
    }
  };

  const sendInvites = async () => {
    setSending(true);
    setResult(null);
    const emailList = emails.split(/[,\n]+/).map((e) => e.trim()).filter(Boolean);
    const phoneList = phones.split(/[,\n]+/).map((p) => p.trim()).filter(Boolean);

    try {
      const data = await api.post(`/api/meetings/rooms/${room._id}/invite`, {
        emails: emailList.length > 0 ? emailList : undefined,
        phones: phoneList.length > 0 ? phoneList : undefined,
        message: customMessage || undefined,
      });
      setResult(data);
    } catch (err) {
      setResult({ message: 'Failed to send invites', errors: [err.message] });
    }
    setSending(false);
  };

  const inputStyle = {
    width: '100%', background: COLORS.bg, border: `1px solid ${COLORS.primary}30`,
    borderRadius: 8, padding: '10px 14px', color: COLORS.text,
    fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit',
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: COLORS.surface, borderRadius: 16, width: 520, maxWidth: '90vw',
          maxHeight: '85vh', overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)', border: `1px solid ${COLORS.primary}30`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: `1px solid ${COLORS.primary}20`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.accent})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
            }}>
              🔗
            </div>
            <div>
              <h3 style={{ margin: 0, color: COLORS.text, fontSize: 18 }}>Share Meeting</h3>
              <p style={{ margin: 0, color: COLORS.muted, fontSize: 12 }}>{room.title}</p>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: COLORS.muted,
            cursor: 'pointer', fontSize: 22,
          }}>
            ×
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, padding: '12px 24px 0' }}>
          {[
            { key: 'link', label: '🔗 Copy Link' },
            { key: 'invite', label: '📧 Send Invites' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                background: tab === t.key ? COLORS.primary : 'transparent',
                color: tab === t.key ? '#fff' : COLORS.muted,
                border: 'none', borderRadius: '8px 8px 0 0',
                padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: 24 }}>
          {tab === 'link' && (
            <div>
              {/* Meeting Info */}
              <div style={{
                background: COLORS.bg, borderRadius: 10, padding: 16, marginBottom: 16,
              }}>
                <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 4 }}>
                  📅 {scheduledStr}
                </div>
                <div style={{ fontSize: 13, color: COLORS.muted }}>
                  ⏱ {room.duration} min · 👤 {room.hostName}
                </div>
              </div>

              {/* Share URL */}
              <div style={{
                display: 'flex', gap: 8, marginBottom: 16,
              }}>
                <input
                  readOnly
                  value={joinUrl}
                  style={{
                    ...inputStyle,
                    flex: 1,
                    fontFamily: 'monospace', fontSize: 12,
                  }}
                  onClick={(e) => e.target.select()}
                />
                <button
                  onClick={copyToClipboard}
                  style={{
                    background: copied ? COLORS.success : COLORS.primary,
                    color: '#fff', border: 'none', borderRadius: 8,
                    padding: '10px 18px', cursor: 'pointer',
                    fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap',
                    transition: 'background 0.2s',
                  }}
                >
                  {copied ? '✓ Copied!' : '📋 Copy'}
                </button>
              </div>

              {/* Quick Share Buttons */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {navigator.share && (
                  <button onClick={shareNative} style={{
                    background: COLORS.accent, color: '#fff', border: 'none',
                    borderRadius: 8, padding: '8px 16px', cursor: 'pointer',
                    fontSize: 13, fontWeight: 600,
                  }}>
                    📤 Share
                  </button>
                )}
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`You're invited to ${room.title}\n\n${scheduledStr}\n\nJoin: ${joinUrl}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    background: '#25D366', color: '#fff', border: 'none',
                    borderRadius: 8, padding: '8px 16px', cursor: 'pointer',
                    fontSize: 13, fontWeight: 600, textDecoration: 'none',
                  }}
                >
                  💬 WhatsApp
                </a>
                <a
                  href={`mailto:?subject=${encodeURIComponent(`Meeting: ${room.title}`)}&body=${encodeURIComponent(`You're invited to ${room.title}\n\nDate: ${scheduledStr}\nDuration: ${room.duration} min\nHost: ${room.hostName}\n\nJoin here: ${joinUrl}`)}`}
                  style={{
                    background: '#4285F4', color: '#fff', border: 'none',
                    borderRadius: 8, padding: '8px 16px', cursor: 'pointer',
                    fontSize: 13, fontWeight: 600, textDecoration: 'none',
                  }}
                >
                  📧 Email
                </a>
                <a
                  href={`sms:?body=${encodeURIComponent(`${room.title} - Join: ${joinUrl}`)}`}
                  style={{
                    background: '#FF9500', color: '#fff', border: 'none',
                    borderRadius: 8, padding: '8px 16px', cursor: 'pointer',
                    fontSize: 13, fontWeight: 600, textDecoration: 'none',
                  }}
                >
                  📱 SMS
                </a>
              </div>
            </div>
          )}

          {tab === 'invite' && (
            <div>
              <p style={{ color: COLORS.muted, fontSize: 13, margin: '0 0 16px' }}>
                Send meeting invites directly to staff via email or SMS.
              </p>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', color: COLORS.muted, fontSize: 12, marginBottom: 6 }}>
                  Email addresses (comma or newline separated)
                </label>
                <textarea
                  value={emails}
                  onChange={(e) => setEmails(e.target.value)}
                  placeholder="admin@pcl.co.ke, staff@pcl.co.ke"
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', color: COLORS.muted, fontSize: 12, marginBottom: 6 }}>
                  Phone numbers (comma or newline separated)
                </label>
                <textarea
                  value={phones}
                  onChange={(e) => setPhones(e.target.value)}
                  placeholder="+254712345678, +254798765432"
                  rows={2}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', color: COLORS.muted, fontSize: 12, marginBottom: 6 }}>
                  Custom message (optional)
                </label>
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Custom invite message..."
                  rows={2}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>

              {result && (
                <div style={{
                  background: result.errors ? `${COLORS.danger}15` : `${COLORS.success}15`,
                  border: `1px solid ${result.errors ? COLORS.danger : COLORS.success}40`,
                  borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13,
                  color: result.errors ? COLORS.danger : COLORS.success,
                }}>
                  {result.message}
                  {result.errors && result.errors.map((e, i) => (
                    <div key={i} style={{ marginTop: 4, fontSize: 12 }}>⚠ {e}</div>
                  ))}
                </div>
              )}

              <button
                onClick={sendInvites}
                disabled={sending || (!emails.trim() && !phones.trim())}
                style={{
                  width: '100%',
                  background: sending || (!emails.trim() && !phones.trim())
                    ? COLORS.muted
                    : `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.accent})`,
                  color: '#fff', border: 'none', borderRadius: 8,
                  padding: '12px', cursor: sending ? 'not-allowed' : 'pointer',
                  fontWeight: 600, fontSize: 14,
                }}
              >
                {sending ? 'Sending...' : '📤 Send Invites'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
