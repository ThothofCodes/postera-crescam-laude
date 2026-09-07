// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// Meeting Auto-Activate — transition SCHEDULED → ACTIVE when scheduledAt passes
const mongoose = require('mongoose');
const Meeting = require('../models/Meeting');
const { notifyParticipants } = require('../utils/meetingNotifications');

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || '';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '';
const LIVEKIT_URL = process.env.LIVEKIT_URL || 'ws://localhost:7880';
const isLiveKitConfigured = !!(LIVEKIT_API_KEY && LIVEKIT_API_SECRET);

/**
 * Find SCHEDULED meetings whose scheduledAt has passed and transition them
 * to ACTIVE. Also ensures the LiveKit room exists and notifies participants.
 *
 * Runs every minute via the cron scheduler in jobs.js.
 */
exports.runMeetingAutoActivate = async function () {
  if (mongoose.connection.readyState !== 1) return;

  try {
    const now = new Date();

    // Find meetings that:
    // - Are still SCHEDULED
    // - Have a scheduledAt that is in the past (or null for instant meetings)
    const overdue = await Meeting.find({
      status: 'SCHEDULED',
      scheduledAt: { $lte: now, $ne: null },
    })
      .populate('host', 'name email phone')
      .populate('participants', 'name email phone');

    if (overdue.length === 0) return;

    for (const room of overdue) {
      try {
        // Ensure the LiveKit room exists before activating
        if (isLiveKitConfigured) {
          try {
            const { RoomServiceClient } = require('livekit-server-sdk');
            const svc = new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
            // listRooms returns an array — if the room exists it'll be there
            const rooms = await svc.listRooms(room.roomName);
            if (!rooms || rooms.length === 0) {
              await svc.createRoom({
                name: room.roomName,
                emptyTimeout: 60 * 5,
                maxParticipants: 50,
              });
              console.log(`[CRON] Auto-Activate: created LiveKit room for "${room.title}"`);
            }
          } catch (lkErr) {
            // Room creation failure is non-fatal — it'll be created on first join
            console.warn(`[CRON] Auto-Activate: LiveKit room setup warning for "${room.title}": ${lkErr.message}`);
          }
        }

        // Transition status
        room.status = 'ACTIVE';
        room.startedAt = now;
        await room.save();

        console.log(`[CRON] Auto-Activate: "${room.title}" → ACTIVE`);

        // Notify participants that the meeting has started
        await notifyParticipants({
          room,
          event: 'started',
          joinerName: room.hostName,
          skipUserId: null, // notify everyone including host
        }).catch(() => {});
      } catch (err) {
        console.error(`[CRON] Auto-Activate: failed for "${room.title}": ${err.message}`);
      }
    }
  } catch (err) {
    console.error('[CRON] MeetingAutoActivate error:', err.message);
  }
};
