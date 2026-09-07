// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// LiveKit Meeting Room — Custom branded video conferencing UI

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  LiveKitRoom,
  Chat,
  ControlBar,
  LayoutContext,
  useParticipants,
  ParticipantTile,
  useTracks,
  TrackRefContext,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Track } from 'livekit-client';

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

/* ── Custom Participant Tile with role badge ── */
function BrandedParticipantTile({ trackRef }) {
  const participant = trackRef?.participant;
  const metadata = useMemo(() => {
    try {
      return JSON.parse(participant?.metadata || '{}');
    } catch {
      return {};
    }
  }, [participant]);

  const isHost = metadata.role === 'SUPER_ADMIN';

  return (
    <div style={{
      position: 'relative',
      borderRadius: 12,
      overflow: 'hidden',
      background: COLORS.surface,
      border: `1px solid ${isHost ? COLORS.primary : '#374151'}`,
    }}>
      <ParticipantTile trackRef={trackRef} />
      {participant && (
        <div style={{
          position: 'absolute',
          bottom: 8,
          left: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'rgba(0,0,0,0.7)',
          borderRadius: 20,
          padding: '4px 10px',
          fontSize: 12,
        }}>
          <span style={{ color: COLORS.text }}>
            {metadata.displayName || participant.identity}
          </span>
          {isHost && (
            <span style={{
              background: COLORS.primary,
              borderRadius: 10,
              padding: '1px 6px',
              fontSize: 10,
              fontWeight: 700,
              color: '#fff',
            }}>
              HOST
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Custom Grid Layout ── */
function BrandedGrid() {
  const participants = useParticipants();
  const videoTracks = useTracks([Track.Source.Camera]);
  const screenTracks = useTracks([Track.Source.ScreenShare]);

  const hasScreenShare = screenTracks.length > 0;

  if (hasScreenShare) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', height: '100%', gap: 8, padding: 8 }}>
        <div style={{ borderRadius: 12, overflow: 'hidden', background: COLORS.bg }}>
          {screenTracks.map((tr) => (
            <TrackRefContext.Provider key={tr.trackSid} value={tr}>
              <ParticipantTile trackRef={tr} />
            </TrackRefContext.Provider>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
          {videoTracks.map((tr) => (
            <div key={tr.trackSid} style={{ flexShrink: 0, height: 140, borderRadius: 8, overflow: 'hidden' }}>
              <TrackRefContext.Provider value={tr}>
                <ParticipantTile trackRef={tr} />
              </TrackRefContext.Provider>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const count = participants.length;
  const cols = count <= 1 ? 1 : count <= 4 ? 2 : count <= 9 ? 3 : 4;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap: 8,
      padding: 8,
      height: '100%',
      alignContent: 'center',
    }}>
      {videoTracks.map((tr) => (
        <div key={tr.trackSid} style={{ aspectRatio: '16/9', borderRadius: 12, overflow: 'hidden' }}>
          <TrackRefContext.Provider value={tr}>
            <ParticipantTile trackRef={tr} />
          </TrackRefContext.Provider>
        </div>
      ))}
    </div>
  );
}

/* ── Meeting Header ── */
function MeetingHeader({ title, description, participantCount, isRecording, onEnd, isHost }) {
  const [time, setTime] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTime((t) => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);
  const mins = Math.floor(time / 60);
  const secs = time % 60;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: COLORS.surface,
      padding: '10px 20px',
      borderBottom: `1px solid ${COLORS.primary}30`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.accent})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 700,
        }}>
          P
        </div>
        <div>
          <div style={{ color: COLORS.text, fontWeight: 600, fontSize: 15 }}>{title}</div>
          {description && (
            <div style={{ color: COLORS.muted, fontSize: 12 }}>{description}</div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: COLORS.bg, borderRadius: 20, padding: '4px 12px',
          fontSize: 13, color: COLORS.muted,
        }}>
          <span style={{ color: COLORS.success, fontSize: 8 }}>●</span>
          {participantCount} participant{participantCount !== 1 ? 's' : ''}
        </div>
        {isRecording && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: '#EF444420', border: '1px solid #EF444440',
            borderRadius: 20, padding: '4px 12px',
            fontSize: 12, color: '#EF4444', fontWeight: 700,
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: '#EF4444', display: 'inline-block',
              animation: 'blink 1s ease-in-out infinite',
            }} />
            REC
          </div>
        )}
        <div style={{
          fontFamily: 'monospace', color: COLORS.accent,
          background: COLORS.bg, borderRadius: 8, padding: '4px 10px',
          fontSize: 14,
        }}>
          {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </div>
        {isHost && (
          <button
            onClick={onEnd}
            style={{
              background: COLORS.danger, color: '#fff', border: 'none',
              borderRadius: 8, padding: '6px 16px', cursor: 'pointer',
              fontWeight: 600, fontSize: 13,
            }}
          >
            End Meeting
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Not Configured Fallback ── */
function NotConfigured() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', background: COLORS.bg, color: COLORS.text, gap: 16,
    }}>
      <div style={{
        width: 80, height: 80, borderRadius: 20,
        background: `linear-gradient(135deg, ${COLORS.primary}20, ${COLORS.accent}20)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 40,
      }}>
        📹
      </div>
      <h2 style={{ margin: 0 }}>LiveKit Not Configured</h2>
      <p style={{ color: COLORS.muted, textAlign: 'center', maxWidth: 400, lineHeight: 1.6 }}>
        Video conferencing requires a LiveKit server.
        Set <code style={{ background: COLORS.surface, padding: '2px 6px', borderRadius: 4 }}>
        LIVEKIT_API_KEY</code> and <code style={{ background: COLORS.surface, padding: '2px 6px', borderRadius: 4 }}>
        LIVEKIT_API_SECRET</code> in your backend .env.
      </p>
      <div style={{
        background: COLORS.surface, borderRadius: 12, padding: 20,
        fontFamily: 'monospace', fontSize: 13, color: COLORS.accent,
        textAlign: 'left', lineHeight: 2,
      }}>
        <div># Option 1: Self-host (free)</div>
        <div>docker run --rm -p 7880:7880 livekit/livekit-server</div>
        <div style={{ marginTop: 8 }}># Option 2: LiveKit Cloud (free tier)</div>
        <div># Sign up at livekit.io → get API key</div>
      </div>
    </div>
  );
}

/* ── Main Meeting Component ────────────────────────────────────────── */
export default function LiveKitMeeting({ room, token, wsUrl, userName, userRole }) {
  const [chatOpen, setChatOpen] = useState(false);
  const [participantCount, setParticipantCount] = useState(1);
  const [isRecording, setIsRecording] = useState(room.isRecording || false);
  const [recordingLoading, setRecordingLoading] = useState(false);
  const isHost = userRole === 'SUPER_ADMIN';

  const toggleRecording = async () => {
    setRecordingLoading(true);
    try {
      const endpoint = isRecording ? 'stop-recording' : 'start-recording';
      const res = await fetch(`/api/meetings/rooms/${room._id}/${endpoint}`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        setIsRecording(!isRecording);
      } else {
        console.error('Recording error:', data.message);
      }
    } catch (err) {
      console.error('Recording toggle failed:', err);
    }
    setRecordingLoading(false);
  };

  const onParticipantUpdate = useCallback((event) => {
    setParticipantCount(event.participants.length);
  }, []);

  if (!token || !wsUrl) return <NotConfigured />;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: COLORS.bg }}>
      <style>{`@keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
      <LiveKitRoom
        serverUrl={wsUrl}
        token={token}
        audio={true}
        video={true}
        data-lk-theme="default"
        style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
        onParticipantsChanged={onParticipantUpdate}
        connect={true}
      >
        <MeetingHeader
          title={room.title}
          description={room.description}
          participantCount={participantCount}
          isRecording={isRecording}
          onEnd={() => {
            fetch(`/api/meetings/rooms/${room._id}/end`, {
              method: 'POST',
              credentials: 'include',
            });
            window.close();
          }}
          isHost={isHost}
        />

        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <LayoutContext>
            <BrandedGrid />
          </LayoutContext>
          {chatOpen && (
            <div style={{
              position: 'absolute', right: 0, top: 0, bottom: 0,
              width: 340, background: COLORS.surface,
              borderLeft: `1px solid ${COLORS.primary}30`,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', borderBottom: `1px solid ${COLORS.primary}20`,
              }}>
                <span style={{ color: COLORS.text, fontWeight: 600 }}>Meeting Chat</span>
                <button
                  onClick={() => setChatOpen(false)}
                  style={{
                    background: 'none', border: 'none', color: COLORS.muted,
                    cursor: 'pointer', fontSize: 18,
                  }}
                >
                  ×
                </button>
              </div>
              <Chat />
            </div>
          )}
        </div>

        <div style={{
          background: COLORS.surface,
          borderTop: `1px solid ${COLORS.primary}20`,
          padding: '8px 16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
              {isRecording && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: '#EF444420', border: '1px solid #EF444440',
                  borderRadius: 8, padding: '6px 12px', fontSize: 13, fontWeight: 600,
                  color: '#EF4444',
                }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: '#EF4444', display: 'inline-block',
                    animation: 'blink 1s ease-in-out infinite',
                  }} />
                  REC
                </div>
              )}
            </div>
            <ControlBar
              style={{ background: 'transparent' }}
              controls={{ screenShare: true, chat: false }}
            />
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
              {isHost && (
                <button
                  onClick={toggleRecording}
                  disabled={recordingLoading}
                  style={{
                    background: isRecording ? '#EF4444' : COLORS.surfaceHover,
                    color: COLORS.text,
                    border: `1px solid ${isRecording ? '#EF4444' : '#4B5563'}`,
                    borderRadius: 8,
                    padding: '8px 14px',
                    cursor: recordingLoading ? 'not-allowed' : 'pointer',
                    fontSize: 14,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontWeight: 600,
                    opacity: recordingLoading ? 0.6 : 1,
                  }}
                >
                  {isRecording ? '⏹ Stop Rec' : '⏺ Record'}
                </button>
              )}
              <button
                onClick={() => setChatOpen(!chatOpen)}
                style={{
                  background: chatOpen ? COLORS.primary : COLORS.surfaceHover,
                  color: COLORS.text,
                  border: `1px solid ${chatOpen ? COLORS.primary : '#4B5563'}`,
                  borderRadius: 8,
                  padding: '8px 14px',
                  cursor: 'pointer',
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                💬 Chat
              </button>
            </div>
          </div>
        </div>
      </LiveKitRoom>
    </div>
  );
}
