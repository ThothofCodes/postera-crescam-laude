// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// Meeting Start Notifications — alert participants when a meeting is about to begin
const mongoose = require('mongoose');
const Meeting = require('../models/Meeting');
const { notifyParticipants } = require('../utils/meetingNotifications');

// Track which meetings we've already sent "starting_soon" notifications for
// to avoid duplicate alerts. Resets when the server restarts (acceptable).
const notified = new Set();

/**
 * Check for SCHEDULED meetings starting within the next 5 minutes and send
 * "starting_soon" notifications to all participants. Runs every minute.
 */
exports.runMeetingStartNotify = async function () {
  if (mongoose.connection.readyState !== 1) return;

  try {
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    // Find meetings that:
    // - Are still SCHEDULED
    // - Have a scheduledAt in the future (but within 5 minutes)
    // - Haven't been notified yet
    const upcoming = await Meeting.find({
      status: 'SCHEDULED',
      scheduledAt: { $gt: now, $lte: fiveMinutesFromNow },
    })
      .populate('host', 'name email phone')
      .populate('participants', 'name email phone');

    for (const room of upcoming) {
      const roomId = room._id.toString();
      if (notified.has(roomId)) continue;

      // Mark as notified before sending (so concurrent runs don't duplicate)
      notified.add(roomId);

      await notifyParticipants({
        room,
        event: 'starting_soon',
        joinerName: null,
      }).catch(() => {});

      console.log(`[CRON] Meeting Start Notify: sent alerts for "${room.title}"`);
    }

    // Clean up notified set for meetings that are no longer upcoming
    // (they've started, ended, or been cancelled)
    if (notified.size > 100) {
      const activeIds = await Meeting.find({ status: 'SCHEDULED' }).distinct('_id');
      const activeSet = new Set(activeIds.map((id) => id.toString()));
      for (const id of notified) {
        if (!activeSet.has(id)) notified.delete(id);
      }
    }
  } catch (err) {
    console.error('[CRON] MeetingStartNotify error:', err.message);
  }
};
