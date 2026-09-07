// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// Meeting Scheduler — Create, manage, and join LiveKit video meetings

import React, { useState, useEffect, useCallback } from 'react';
import analytics from '../../../utils/analytics';

import LiveKitMeeting from '../../components/LiveKitMeeting';
import ShareMeetingModal from '../../components/ShareMeetingModal';

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
  warning: '#F59E0B',
};

const api = {
  get: (url) => fetch(url, { credentials: 'include' }).then((r) => r.json()),
  post: (url, data) => fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then((r) => r.json()),
  delete: (url) => fetch(url, {
    method: 'DELETE',
    credentials: 'include',
  }).then((r) => r.json()),
};

/* ── Status Badge ── */
function StatusBadge({ status }) {
  const map = {
    SCHEDULED: { bg: `${COLORS.primary}20`, color: COLORS.primary, icon: '📅' },
    ACTIVE: { bg: `${COLORS.success}20`, color: COLORS.success, icon: '🟢' },
    ENDED: { bg: `${COLORS.muted}20`, color: COLORS.muted, icon: '⏹' },
    CANCELLED: { bg: `${COLORS.danger}20`, color: COLORS.danger, icon: '❌' },
  };
  const s = map[status] || map.SCHEDULED;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: s.bg, color: s.color, borderRadius: 20,
      padding: '3px 10px', fontSize: 12, fontWeight: 600,
    }}>
      {s.icon} {status}
    </span>
  );
}

/* ── Create Meeting Modal ── */
function CreateMeetingModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState({
    title: '', description: '', scheduledAt: '',
    duration: 60, department: '', isRecurring: false,
  });
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setLoading(true);
    try {
      const result = await api.post('/api/meetings/rooms', {
        ...form,
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
      });
      if (result.room) {
        analytics.meetingCreated(form.title, form.participants?.length || 0);
        onCreated(result);
        setForm({ title: '', description: '', scheduledAt: '', duration: 60, department: '', isRecurring: false });
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div
        style={{
          background: COLORS.surface, borderRadius: 16, width: 520, maxWidth: '90vw',
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
              📹
            </div>
            <div>
              <h3 style={{ margin: 0, color: COLORS.text, fontSize: 18 }}>New Meeting</h3>
              <p style={{ margin: 0, color: COLORS.muted, fontSize: 12 }}>Create a video conference room</p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: COLORS.muted,
              cursor: 'pointer', fontSize: 22,
            }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', color: COLORS.muted, fontSize: 12, marginBottom: 6 }}>
              Meeting Title *
            </label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Weekly Team Sync"
              required
              style={{
                width: '100%', background: COLORS.bg, border: `1px solid ${COLORS.primary}30`,
                borderRadius: 8, padding: '10px 14px', color: COLORS.text,
                fontSize: 14, boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', color: COLORS.muted, fontSize: 12, marginBottom: 6 }}>
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Meeting agenda or notes..."
              rows={3}
              style={{
                width: '100%', background: COLORS.bg, border: `1px solid ${COLORS.primary}30`,
                borderRadius: 8, padding: '10px 14px', color: COLORS.text,
                fontSize: 14, resize: 'vertical', boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', color: COLORS.muted, fontSize: 12, marginBottom: 6 }}>
                Schedule (leave blank for instant)
              </label>
              <input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                style={{
                  width: '100%', background: COLORS.bg, border: `1px solid ${COLORS.primary}30`,
                  borderRadius: 8, padding: '10px 14px', color: COLORS.text,
                  fontSize: 14, boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: COLORS.muted, fontSize: 12, marginBottom: 6 }}>
                Duration (minutes)
              </label>
              <select
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: parseInt(e.target.value) })}
                style={{
                  width: '100%', background: COLORS.bg, border: `1px solid ${COLORS.primary}30`,
                  borderRadius: 8, padding: '10px 14px', color: COLORS.text,
                  fontSize: 14, boxSizing: 'border-box',
                }}
              >
                {[15, 30, 45, 60, 90, 120].map((m) => (
                  <option key={m} value={m}>{m} min</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', color: COLORS.muted, fontSize: 12, marginBottom: 6 }}>
              Department
            </label>
            <select
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              style={{
                width: '100%', background: COLORS.bg, border: `1px solid ${COLORS.primary}30`,
                borderRadius: 8, padding: '10px 14px', color: COLORS.text,
                fontSize: 14, boxSizing: 'border-box',
              }}
            >
              <option value="">All Departments</option>
              <option value="internet">Internet Distribution</option>
              <option value="webdev">Web Development</option>
              <option value="playstation">PlayStation Arena</option>
              <option value="cyber">Cyber Security</option>
              <option value="school">School of Computing</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: COLORS.surfaceHover, color: COLORS.text, border: 'none',
                borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontSize: 14,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !form.title.trim()}
              style={{
                background: loading ? COLORS.muted : `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.accent})`,
                color: '#fff', border: 'none', borderRadius: 8,
                padding: '10px 24px', cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 600, fontSize: 14,
              }}
            >
              {loading ? 'Creating...' : '🚀 Create Meeting'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Meeting Recording Modal ── */
function RecordingModal({ open, onClose, room }) {
  if (!open || !room || !room.recordingUrl) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: COLORS.surface, borderRadius: 16, width: 800, maxWidth: '90vw',
          maxHeight: '85vh', overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)', border: `1px solid ${COLORS.primary}30`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
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
              🎬
            </div>
            <div>
              <h3 style={{ margin: 0, color: COLORS.text, fontSize: 18 }}>{room.title}</h3>
              <p style={{ margin: 0, color: COLORS.muted, fontSize: 12 }}>Meeting Recording</p>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: COLORS.muted,
            cursor: 'pointer', fontSize: 22,
          }}>
            ×
          </button>
        </div>
        <div style={{ padding: 24 }}>
          <video
            controls
            autoPlay
            style={{
              width: '100%', borderRadius: 10, background: '#000',
              maxHeight: '60vh',
            }}
          >
            <source src={room.recordingUrl} />
            Your browser does not support video playback.
          </video>
          <div style={{
            marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ fontSize: 13, color: COLORS.muted }}>
              🎬 Recording • {room.title}
            </div>
            <a
              href={room.recordingUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: `${COLORS.accent}20`, color: COLORS.accent,
                border: `1px solid ${COLORS.accent}40`,
                borderRadius: 8, padding: '8px 16px', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, textDecoration: 'none',
              }}
            >
              ⬇ Download
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Meeting Card ── */
function MeetingCard({ room, onJoin, onEnd, onDelete, onShare, onPlayRecording, onSyncCalendar }) {
  const scheduledDate = room.scheduledAt ? new Date(room.scheduledAt) : null;
  const isUpcoming = scheduledDate && scheduledDate > new Date() && room.status === 'SCHEDULED';
  const isActive = room.status === 'ACTIVE';

  return (
    <div style={{
      background: COLORS.surface, borderRadius: 12, padding: 20,
      border: `1px solid ${isActive ? COLORS.success : COLORS.primary}20`,
      transition: 'all 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0, color: COLORS.text, fontSize: 16 }}>{room.title}</h3>
          {room.description && (
            <p style={{ margin: '4px 0 0', color: COLORS.muted, fontSize: 13 }}>{room.description}</p>
          )}
        </div>
        <StatusBadge status={room.status} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16, fontSize: 12, color: COLORS.muted }}>
        <span>👤 {room.hostName}</span>
        {room.department && <span>🏢 {room.department}</span>}
        <span>⏱ {room.duration} min</span>
        {scheduledDate && (
          <span>📅 {scheduledDate.toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
          })}</span>
        )}
        <span>👥 {room.participants?.length || 0} invited</span>
        {room.scheduledAt && (
          <span style={{ color: COLORS.accent, fontWeight: 600 }}>📆 Calendar</span>
        )}
        {room.recordingUrl && (
          <span style={{ color: '#EF4444', fontWeight: 600 }}>🎬 Has Recording</span>
        )}
        {room.isRecording && (
          <span style={{ color: '#EF4444', fontWeight: 600 }}>⏺ Recording…</span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {(isActive || room.status === 'SCHEDULED') && (
          <button
            onClick={() => onJoin(room)}
            style={{
              background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.accent})`,
              color: '#fff', border: 'none', borderRadius: 8,
              padding: '8px 16px', cursor: 'pointer', fontWeight: 600,
              fontSize: 13,
            }}
          >
            {isActive ? '🔗 Join Now' : '▶ Start Meeting'}
          </button>
        )}
        {isActive && (
          <button
            onClick={() => onEnd(room._id)}
            style={{
              background: `${COLORS.danger}20`, color: COLORS.danger, border: `1px solid ${COLORS.danger}40`,
              borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13,
            }}
          >
            ⏹ End
          </button>
        )}
        {room.status !== 'ACTIVE' && (
          <button
            onClick={() => onDelete(room._id)}
            style={{
              background: 'none', color: COLORS.muted, border: `1px solid ${COLORS.muted}40`,
              borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13,
            }}
          >
            🗑 Delete
          </button>
        )}
        {room.recordingUrl && onPlayRecording && (
          <button
            onClick={() => onPlayRecording(room)}
            style={{
              background: '#EF444420', color: '#EF4444',
              border: '1px solid #EF444440',
              borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13,
              fontWeight: 600,
            }}
          >
            🎬 Watch Recording
          </button>
        )}
        {room.scheduledAt && (
          <button
            onClick={() => onSyncCalendar(room)}
            style={{
              background: '#4285F420', color: '#4285F4',
              border: '1px solid #4285F440',
              borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13,
            }}
          >
            📆 Add to Calendar
          </button>
        )}
        <button
          onClick={() => onShare(room)}
          style={{
            background: `${COLORS.accent}20`, color: COLORS.accent, border: `1px solid ${COLORS.accent}40`,
            borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13,
          }}
        >
          🔗 Share
        </button>
      </div>
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────────────────── */
export default function MeetingScheduler() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState('all');
  const [activeMeeting, setActiveMeeting] = useState(null);
  const [meetingToken, setMeetingToken] = useState(null);
  const [wsUrl, setWsUrl] = useState(null);
  const [meetingInfo, setMeetingInfo] = useState(null);
  const [shareRoom, setShareRoom] = useState(null);
  const [recordingRoom, setRecordingRoom] = useState(null);
  const calendarConfigured = true; // ICS calendar always available
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const data = await api.get(`/api/meetings/rooms${params}`);
      setRooms(data.rooms || []);
    } catch (err) {
      console.error('Failed to fetch meetings:', err);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  const handleJoin = async (room) => {
    try {
      const data = await api.post(`/api/meetings/rooms/${room._id}/join`);
      if (data.token) {
        analytics.meetingJoined(room._id);
        setMeetingToken(data.token);
        setWsUrl(data.wsUrl);
        setActiveMeeting(room._id);
        setMeetingInfo(data.room);
      }
    } catch (err) {
      console.error('Failed to join meeting:', err);
    }
  };

  const handleEnd = async (id) => {
    if (!window.confirm('End this meeting?')) return;
    await api.post(`/api/meetings/rooms/${id}/end`);
    setActiveMeeting(null);
    setMeetingToken(null);
    fetchRooms();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this meeting?')) return;
    await api.delete(`/api/meetings/rooms/${id}`);
    fetchRooms();
  };

  const handleCreated = (result) => {
    setShowCreate(false);
    fetchRooms();
    // Auto-join if instant meeting
    if (result.room && !result.room.scheduledAt) {
      handleJoin(result.room);
    }
  };

  const handleSyncCalendar = async (room) => {
    try {
      const data = await api.post(`/api/meetings/rooms/${room._id}/sync-calendar`);
      if (data.icsUrl) {
        // Download the ICS file
        window.open(`/api/meetings/rooms/${room._id}/calendar.ics`, '_blank');
      }
    } catch (err) {
      console.error('Calendar file generation failed:', err);
    }
  };


  // If in a meeting, show the video room
  if (activeMeeting && meetingToken && wsUrl && meetingInfo) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
        <button
          onClick={() => {
            handleEnd(activeMeeting);
            setActiveMeeting(null);
            setMeetingToken(null);
          }}
          style={{
            position: 'absolute', top: 12, left: 12, zIndex: 10000,
            background: COLORS.danger, color: '#fff', border: 'none',
            borderRadius: 8, padding: '8px 16px', cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          ← Back to Meetings
        </button>
        <LiveKitMeeting
          room={meetingInfo}
          token={meetingToken}
          wsUrl={wsUrl}
          userName={user.name}
          userRole={user.role}
        />
      </div>
    );
  }

  const tabs = [
    { key: 'all', label: 'All', count: rooms.length },
    { key: 'SCHEDULED', label: '📅 Scheduled', count: rooms.filter((r) => r.status === 'SCHEDULED').length },
    { key: 'ACTIVE', label: '🟢 Active', count: rooms.filter((r) => r.status === 'ACTIVE').length },
    { key: 'ENDED', label: '⏹ Ended', count: rooms.filter((r) => r.status === 'ENDED').length },
  ];

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.accent})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, boxShadow: `0 4px 20px ${COLORS.primary}40`,
          }}>
            📹
          </div>
          <div>
            <h1 style={{ margin: 0, color: COLORS.text, fontSize: 24, fontWeight: 700 }}>
              Meeting Room
            </h1>
            <p style={{ margin: 0, color: COLORS.muted, fontSize: 13 }}>
              Create and manage video conferences for your team
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.accent})`,
            color: '#fff', border: 'none', borderRadius: 10,
            padding: '12px 24px', cursor: 'pointer',
            fontWeight: 600, fontSize: 14,
            boxShadow: `0 4px 16px ${COLORS.primary}40`,
          }}
        >
          + New Meeting
        </button>
      </div>

      {/* Calendar Status Banner */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: `${COLORS.success}10`, border: `1px solid ${COLORS.success}30`,
        borderRadius: 10, padding: '10px 16px', marginBottom: 20, fontSize: 13,
        color: COLORS.success,
      }}>
        <span>📆</span>
        <span>Calendar integration active — download .ics files for scheduled meetings</span>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 24,
        background: COLORS.surface, borderRadius: 10, padding: 4,
        width: 'fit-content',
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            style={{
              background: filter === tab.key ? COLORS.primary : 'transparent',
              color: filter === tab.key ? '#fff' : COLORS.muted,
              border: 'none', borderRadius: 8, padding: '8px 16px',
              cursor: 'pointer', fontSize: 13, fontWeight: 600,
              transition: 'all 0.2s',
            }}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Meeting List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: COLORS.muted }}>
          Loading meetings...
        </div>
      ) : rooms.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 60,
          background: COLORS.surface, borderRadius: 16,
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📹</div>
          <h3 style={{ color: COLORS.text, margin: '0 0 8px' }}>No meetings yet</h3>
          <p style={{ color: COLORS.muted, margin: '0 0 20px' }}>
            Create your first meeting to start video conferencing with your team
          </p>
          <button
            onClick={() => setShowCreate(true)}
            style={{
              background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.accent})`,
              color: '#fff', border: 'none', borderRadius: 10,
              padding: '12px 24px', cursor: 'pointer', fontWeight: 600,
            }}
          >
            + Create Meeting
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {rooms.map((room) => (
            <MeetingCard
              key={room._id}
              room={room}
              onJoin={handleJoin}
              onEnd={handleEnd}
              onDelete={handleDelete}
              onShare={() => setShareRoom(room)}
              onPlayRecording={(r) => setRecordingRoom(r)}
              onSyncCalendar={handleSyncCalendar}
            />
          ))}
        </div>
      )}

      <CreateMeetingModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={handleCreated}
      />

      <ShareMeetingModal
        open={!!shareRoom}
        onClose={() => setShareRoom(null)}
        room={shareRoom}
      />

      <RecordingModal
        open={!!recordingRoom}
        onClose={() => setRecordingRoom(null)}
        room={recordingRoom}
      />
    </div>
  );
}
