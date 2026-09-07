// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// LiveKit Meeting Routes — Room creation, token generation, scheduling

const express = require('express');

const router = express.Router();
const { protect, superAdminGuard } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createMeetingSchema, mongoId } = require('../validations/schemas');
const { z } = require('zod');

// LiveKit server SDK
const {
  AccessToken,
  RoomServiceClient,
  EgressClient,
  WebhookReceiver,
} = require('livekit-server-sdk');

const Room = require('../models/Meeting');
const { notifyParticipants } = require('../utils/meetingNotifications');
const {
  getConfigured: isCalendarConfigured,
  createCalendarEvent,
  deleteCalendarEvent,
} = require('../config/googleCalendar');

// ── LiveKit Config ───────────────────────────────────────────────────────
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || '';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '';
const LIVEKIT_URL = process.env.LIVEKIT_URL || 'ws://localhost:7880';
const LIVEKIT_WS_URL = process.env.LIVEKIT_WS_URL || LIVEKIT_URL.replace(/^http/, 'ws');

const isConfigured = !!(LIVEKIT_API_KEY && LIVEKIT_API_SECRET);

function getRoomService() {
  if (!isConfigured) throw new Error('LiveKit not configured. Set LIVEKIT_API_KEY and LIVEKIT_API_SECRET.');
  return new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
}

function getEgressService() {
  if (!isConfigured) throw new Error('LiveKit not configured. Set LIVEKIT_API_KEY and LIVEKIT_API_SECRET.');
  return new EgressClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
}

function generateToken(roomName, identity, name, role) {
  if (!isConfigured) throw new Error('LiveKit not configured.');
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity,
    name,
    ttl: 60 * 60 * 4, // 4 hours
  });
  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
  // Add metadata with role info
  at.metadata = JSON.stringify({ role: role || 'STAFF', displayName: name });
  return at.toJwt();
}

// ── Create Room ──────────────────────────────────────────────────────────
router.post('/rooms', protect, validate(createMeetingSchema), async (req, res) => {
  try {
    const {
      title, description, scheduledAt, duration,
      department, participants, isRecurring,
    } = req.body;

    if (!title) {
      return res.status(400).json({ message: 'Meeting title is required' });
    }

    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 48);
    const roomName = `pcl-${slug}-${Date.now()}`;

    const room = await Room.create({
      roomName,
      title,
      description: description || '',
      scheduledAt: scheduledAt || null,
      duration: duration || 60,
      department: department || null,
      participants: participants || [],
      isRecurring: isRecurring || false,
      host: req.user._id,
      hostName: req.user.name,
      status: 'SCHEDULED',
    });

    // Create the LiveKit room if server is configured
    if (isConfigured) {
      try {
        const svc = getRoomService();
        await svc.createRoom({
          name: roomName,
          emptyTimeout: 60 * 5, // 5 min timeout when empty
          maxParticipants: 50,
        });
      } catch { /* Room will be created on first join */ }
    }

    // Generate ICS calendar file if meeting is scheduled
    if (isCalendarConfigured() && room.scheduledAt) {
      try {
        await createCalendarEvent(room);
      } catch { /* ICS generation is best-effort */ }
    }

    res.status(201).json({
      message: 'Meeting room created',
      room,
      joinUrl: `${process.env.CLIENT_URL || 'http://localhost:3000'}/admin/meeting/${room._id}`,
    });
  } catch (err) {
    console.error('Create meeting error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// ── List Rooms ───────────────────────────────────────────────────────────
router.get('/rooms', protect, async (req, res) => {
  try {
    const { status, department, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (department) filter.department = department;

    const rooms = await Room.find(filter)
      .populate('host', 'name email role')
      .populate('participants', 'name email role department')
      .sort({ scheduledAt: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit, 10));

    const total = await Room.countDocuments(filter);

    res.json({ rooms, total, page: parseInt(page, 10) });
  } catch (err) {
    console.error('List meetings error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// ── Get Single Room ──────────────────────────────────────────────────────
router.get('/rooms/:id', protect, validate(z.object({ id: mongoId }), 'params'), async (req, res) => {
  try {
    const room = await Room.findById(req.params.id)
      .populate('host', 'name email role')
      .populate('participants', 'name email role department');
    if (!room) return res.status(404).json({ message: 'Meeting not found' });
    res.json(room);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Join Room (get token) ────────────────────────────────────────────────
router.post('/rooms/:id/join', protect, validate(z.object({ id: mongoId }), 'params'), async (req, res) => {
  try {
    const room = await Room.findById(req.params.id)
      .populate('host', 'name email phone')
      .populate('participants', 'name email phone');
    if (!room) return res.status(404).json({ message: 'Meeting not found' });

    const isFirstJoin = room.status === 'SCHEDULED';
    const wasAlreadyParticipant = room.participants.some(
      (p) => (p._id || p).toString() === req.user._id.toString(),
    );

    const identity = `${req.user._id}-${Date.now()}`;
    const token = generateToken(
      room.roomName,
      identity,
      req.user.name,
      req.user.role,
    );

    // Update room status
    if (isFirstJoin) {
      room.status = 'ACTIVE';
      room.startedAt = new Date();
    }

    // Add user to participants if not already there
    if (!wasAlreadyParticipant) {
      room.participants.push(req.user._id);
    }
    await room.save();

    // Re-fetch with populated participants for notification context
    const populated = await Room.findById(room._id)
      .populate('host', 'name email phone')
      .populate('participants', 'name email phone');

    // Notify other participants (fire-and-forget, don't block the response)
    const notifyEvent = isFirstJoin ? 'started' : 'joining';
    notifyParticipants({
      room: populated,
      event: notifyEvent,
      joinerName: req.user.name,
      skipUserId: req.user._id,
    }).catch(() => {});

    res.json({
      token,
      wsUrl: LIVEKIT_WS_URL,
      roomName: room.roomName,
      room: populated,
    });
  } catch (err) {
    console.error('Join meeting error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// ── End Meeting ──────────────────────────────────────────────────────────
router.post('/rooms/:id/end', protect, validate(z.object({ id: mongoId }), 'params'), async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Meeting not found' });

    room.status = 'ENDED';
    room.endedAt = new Date();
    await room.save();

    // Delete LiveKit room if configured
    if (isConfigured) {
      try {
        const svc = getRoomService();
        await svc.deleteRoom(room.roomName);
      } catch { /* Best effort */ }
    }

    res.json({ message: 'Meeting ended' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Delete Meeting ───────────────────────────────────────────────────────
router.delete('/rooms/:id', protect, superAdminGuard, validate(z.object({ id: mongoId }), 'params'), async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Meeting not found' });

    // Delete LiveKit room if configured
    if (isConfigured && room.status === 'ACTIVE') {
      try {
        const svc = getRoomService();
        await svc.deleteRoom(room.roomName);
      } catch { /* Best effort */ }
    }

    // Remove from Google Calendar if it was synced
    deleteCalendarEvent(room._id).catch(() => {});

    await Room.findByIdAndDelete(req.params.id);
    res.json({ message: 'Meeting deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Start Recording (Egress) ─────────────────────────────────────────────
router.post('/rooms/:id/start-recording', protect, validate(z.object({ id: mongoId }), 'params'), async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Meeting not found' });
    if (room.status !== 'ACTIVE') {
      return res.status(400).json({ message: 'Can only record active meetings' });
    }
    if (room.isRecording && room.recordingEgressId) {
      return res.status(400).json({ message: 'Recording already in progress' });
    }

    if (!isConfigured) {
      return res.status(503).json({ message: 'LiveKit not configured — recording unavailable' });
    }

    const egress = getEgressService();
    const fileInfo = {
      filepath: `recordings/${room.roomName}/${Date.now()}.mp4`,
    };

    const info = await egress.startRoomCompositeEgress(
      room.roomName,
      { file: fileInfo },
      { layout: 'speaker', encodingOptions: 1 }, // H264_1080p preset
    );

    room.recordingEgressId = info.egressId;
    room.isRecording = true;
    await room.save();

    res.json({ message: 'Recording started', egressId: info.egressId });
  } catch (err) {
    console.error('Start recording error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// ── Stop Recording (Egress) ────────────────────────────────────────────
router.post('/rooms/:id/stop-recording', protect, validate(z.object({ id: mongoId }), 'params'), async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Meeting not found' });
    if (!room.isRecording || !room.recordingEgressId) {
      return res.status(400).json({ message: 'No active recording found' });
    }

    if (!isConfigured) {
      return res.status(503).json({ message: 'LiveKit not configured — recording unavailable' });
    }

    const egress = getEgressService();
    await egress.stopEgress(room.recordingEgressId);

    room.isRecording = false;
    await room.save();

    res.json({ message: 'Recording stopped — processing will complete shortly' });
  } catch (err) {
    console.error('Stop recording error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// ── Get Recording Status ───────────────────────────────────────────────
router.get('/rooms/:id/recording', protect, validate(z.object({ id: mongoId }), 'params'), async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Meeting not found' });

    res.json({
      isRecording: room.isRecording,
      recordingUrl: room.recordingUrl || null,
      egressId: room.recordingEgressId || null,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── LiveKit Webhook ──────────────────────────────────────────────────────

// ── Send Meeting Invites (email + SMS) ─────────────────────────────────────
router.post('/rooms/:id/invite', protect, validate(z.object({ id: mongoId }), 'params'), async (req, res) => {
  try {
    const { emails, phones, message } = req.body;
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Meeting not found' });

    const joinUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/admin/meetings?join=${room._id}`;
    const scheduledStr = room.scheduledAt
      ? new Date(room.scheduledAt).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })
      : 'Starting now';
    const inviteMsg = message || `You are invited to ${room.title} (${scheduledStr}). Join here: ${joinUrl}`;

    let emailsSent = 0;
    let smsSent = 0;
    const errors = [];

    // Send emails
    if (emails && emails.length > 0) {
      const { sendEmail } = require('../config/mailer');
      for (const email of emails) {
        try {
          await sendEmail({
            to: email,
            subject: `Meeting Invite: ${room.title}`,
            html: '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">'
              + '<div style="background:linear-gradient(135deg,#FF6B00,#00C7B7);border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">'
              + '<h1 style="color:#fff;margin:0;font-size:22px;">Meeting Invite</h1></div>'
              + `<h2 style="color:#111;margin:0 0 8px;">${room.title}</h2>`
              + (room.description ? `<p style="color:#666;margin:0 0 16px;">${room.description}</p>` : '')
              + '<div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:20px;">'
              + `<p style="margin:4px 0;color:#374151;"><strong>${scheduledStr}</strong></p>`
              + `<p style="margin:4px 0;color:#374151;">Duration: ${room.duration} minutes</p>`
              + `<p style="margin:4px 0;color:#374151;">Host: ${room.hostName}</p></div>`
              + `<a href="${joinUrl}" style="display:inline-block;background:linear-gradient(135deg,#FF6B00,#00C7B7);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;">Join Meeting</a>`
              + '<p style="color:#999;font-size:12px;margin-top:24px;">Postera Crescam Laude</p></div>',
          });
          emailsSent++;
        } catch (err) {
          errors.push(`Email ${email}: ${err.message}`);
        }
      }
    }

    // Send SMS
    if (phones && phones.length > 0) {
      const { sendSMS } = require('../config/africastalking');
      for (const phone of phones) {
        try {
          await sendSMS(phone, inviteMsg);
          smsSent++;
        } catch (err) {
          errors.push(`SMS ${phone}: ${err.message}`);
        }
      }
    }

    // Add participants to the room
    if (req.body.userIds && req.body.userIds.length > 0) {
      const newParticipants = req.body.userIds.filter(
        (id) => !room.participants.includes(id),
      );
      room.participants.push(...newParticipants);
      await room.save();
    }

    res.json({
      message: `Invites sent: ${emailsSent} emails, ${smsSent} SMS`,
      emailsSent,
      smsSent,
      errors: errors.length > 0 ? errors : undefined,
      joinUrl,
    });
  } catch (err) {
    console.error('Invite error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// ── Get Join URL (no auth — for sharing) ─────────────────────────────────
router.get('/rooms/:id/join-url', validate(z.object({ id: mongoId }), 'params'), (req, res) => {
  const joinUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/admin/meetings?join=${req.params.id}`;
  res.json({ joinUrl });
});

router.post('/webhook', express.raw({ type: 'application/webhook+protobuf' }), async (req, res) => {
  if (!isConfigured) return res.status(200).json({ ok: true });
  try {
    const receiver = new WebhookReceiver(LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
    const event = await receiver.receive(req.body, req.headers);
    console.log('[LiveKit Webhook]', event.event);

    // Handle Egress ended — save the recording URL on the meeting
    if (event.event === 'egress_ended') {
      try {
        const egressInfo = event.info || event.egressInfo || {};
        const egressId = egressInfo.egressId || '';
        const roomName = egressInfo.roomName || '';

        if (egressId && roomName) {
          const room = await Room.findOne({ roomName });
          if (room) {
            // Extract file URL from egress results
            const fileResults = egressInfo.fileResults || [];
            const segmentResults = egressInfo.segmentResults || [];
            const url = (fileResults[0] && fileResults[0].url)
              || (segmentResults[0] && segmentResults[0].baseUrl)
              || null;

            room.isRecording = false;
            if (url) room.recordingUrl = url;
            await room.save();
            console.log(`[Egress] Recording saved for room ${roomName}: ${url}`);
          }
        }
      } catch (webhookErr) {
        console.error('Egress webhook processing error:', webhookErr.message);
      }
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('LiveKit webhook error:', err.message);
    res.status(200).json({ ok: true }); // Always 200 for webhooks
  }
});

// ── Status ───────────────────────────────────────────────────────────────
router.get('/status', protect, (req, res) => {
  res.json({
    configured: isConfigured,
    wsUrl: LIVEKIT_WS_URL,
    features: ['video', 'audio', 'screen-share', 'chat', 'recording'],
    calendar: isCalendarConfigured(),
  });
});

// ── Calendar (ICS download) ───────────────────────────────────────────────

// Generate and download ICS calendar file for a meeting (redirects to MinIO URL)
router.get('/rooms/:id/calendar.ics', protect, validate(z.object({ id: mongoId }), 'params'), async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Meeting not found' });
    if (!room.scheduledAt) {
      return res.status(400).json({ message: 'Only scheduled meetings can generate a calendar file' });
    }

    const { generateICSBuffer } = require('../config/googleCalendar');
    const icsBuffer = await generateICSBuffer(room);
    if (!icsBuffer) {
      return res.status(500).json({ message: 'Failed to generate calendar file' });
    }

    // Serve ICS content directly (no redirect to MinIO — prevents URL exposure)
    const filename = `PCL-Meeting-${(room.title || 'event').replace(/[^a-zA-Z0-9-]/g, '_')}.ics`;
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(icsBuffer);
  } catch (err) {
    console.error('ICS download error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// Generate and return ICS URL for a meeting
router.post('/rooms/:id/sync-calendar', protect, validate(z.object({ id: mongoId }), 'params'), async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Meeting not found' });
    if (!room.scheduledAt) {
      return res.status(400).json({ message: 'Only scheduled meetings can generate a calendar file' });
    }

    const { generateICS } = require('../config/googleCalendar');
    const icsUrl = await generateICS(room);

    res.json({
      message: icsUrl ? 'Calendar file generated' : 'Failed to generate calendar file',
      icsUrl,
      downloadUrl: icsUrl ? `/api/meetings/rooms/${room._id}/calendar.ics` : null,
    });
  } catch (err) {
    console.error('ICS generation error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// Remove ICS file for a meeting
router.post('/rooms/:id/unsync-calendar', protect, validate(z.object({ id: mongoId }), 'params'), async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Meeting not found' });

    const { deleteICS } = require('../config/googleCalendar');
    await deleteICS(room._id);

    res.json({ message: 'Calendar file removed' });
  } catch (err) {
    console.error('Calendar unsync error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// Calendar status — always returns true (ICS needs no external API)
router.get('/calendar/status', protect, (req, res) => {
  res.json({ configured: true });
});

module.exports = router;
