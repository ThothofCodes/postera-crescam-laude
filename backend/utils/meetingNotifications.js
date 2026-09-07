// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// Meeting Notifications — email, SMS, and in-app alerts for starts and joins

const User = require('../models/User');
const Notification = require('../models/Notification');

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

/**
 * Build the branded PCL meeting email HTML.
 */
function buildEmailHtml({
  heading, title, description, details, joinUrl, joinLabel,
}) {
  const detailsHtml = (details || [])
    .map((d) => `<p style="margin:4px 0;color:#374151;">${d}</p>`)
    .join('');

  return '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">'
    + '<div style="background:linear-gradient(135deg,#FF6B00,#00C7B7);border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">'
    + `<h1 style="color:#fff;margin:0;font-size:22px;">${heading}</h1></div>`
    + `<h2 style="color:#111;margin:0 0 8px;">${title}</h2>`
    + (description ? `<p style="color:#666;margin:0 0 16px;">${description}</p>` : '')
    + '<div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:20px;">'
    + detailsHtml + '</div>'
    + `<a href="${joinUrl}" style="display:inline-block;background:linear-gradient(135deg,#FF6B00,#00C7B7);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;">${joinLabel}</a>`
    + '<p style="color:#999;font-size:12px;margin-top:24px;">Postera Crescam Laude</p></div>';
}

/**
 * Send email + SMS + in-app notification to a list of users about a meeting event.
 * Skips the `skipUserId` (e.g. the joiner themselves doesn't get a "you joined" nudge).
 *
 * @param {Object}  opts
 * @param {Object}  opts.room        - Populated Meeting document
 * @param {string}  opts.event       - 'started' | 'joining' | 'starting_soon'
 * @param {string}  opts.joinerName  - Name of the person who joined (for 'joining' event)
 * @param {string}  [opts.skipUserId] - User ID to skip (the actor)
 */
async function notifyParticipants({
  room, event, joinerName, skipUserId,
}) {
  // Collect participant IDs (unique, excluding skip)
  const ids = [...new Set(
    (room.participants || [])
      .map((p) => (typeof p === 'object' ? (p._id || p).toString() : p.toString()))
      .filter((id) => id !== (skipUserId ? skipUserId.toString() : '')),
  )];

  // Also notify the host if they aren't already in participants and aren't the skip user
  const hostId = typeof room.host === 'object'
    ? (room.host._id || room.host).toString()
    : room.host.toString();
  if (hostId !== (skipUserId ? skipUserId.toString() : '') && !ids.includes(hostId)) {
    ids.push(hostId);
  }

  if (ids.length === 0) return { emailsSent: 0, smsSent: 0, inAppSent: 0 };

  const users = await User.find({ _id: { $in: ids } }).select('name email phone');
  if (users.length === 0) return { emailsSent: 0, smsSent: 0, inAppSent: 0 };

  const joinUrl = `${CLIENT_URL}/admin/meetings?join=${room._id}`;
  const scheduledStr = room.scheduledAt
    ? new Date(room.scheduledAt).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })
    : 'now';

  let subject = '';
  let emailHtml = '';
  let smsText = '';
  let inAppTitle = '';
  let inAppMessage = '';
  let inAppType = 'info';

  if (event === 'started') {
    subject = `Meeting Started: ${room.title}`;
    inAppTitle = `Meeting Started: ${room.title}`;
    inAppMessage = `${joinerName || 'Someone'} has started "${room.title}". You can join now.`;
    inAppType = 'success';
    emailHtml = buildEmailHtml({
      heading: 'Meeting Started',
      title: room.title,
      description: room.description,
      details: [
        `Started by: ${joinerName || room.hostName}`,
        `Duration: ${room.duration} min`,
      ],
      joinUrl,
      joinLabel: 'Join Now',
    });
    smsText = `Meeting "${room.title}" has started by ${joinerName || room.hostName}. Join: ${joinUrl}`;
  } else if (event === 'joining') {
    subject = `${joinerName} joined: ${room.title}`;
    inAppTitle = `${joinerName} joined "${room.title}"`;
    inAppMessage = `${joinerName} has joined the meeting "${room.title}".`;
    inAppType = 'info';
    emailHtml = buildEmailHtml({
      heading: 'Participant Joined',
      title: room.title,
      description: room.description,
      details: [
        `${joinerName} has joined the meeting`,
        `Duration: ${room.duration} min`,
      ],
      joinUrl,
      joinLabel: 'Join Meeting',
    });
    smsText = `${joinerName} joined "${room.title}". Join: ${joinUrl}`;
  } else if (event === 'starting_soon') {
    subject = `Meeting Starting Soon: ${room.title}`;
    inAppTitle = `Upcoming: ${room.title}`;
    inAppMessage = `"${room.title}" is starting at ${scheduledStr}. Get ready to join!`;
    inAppType = 'warning';
    emailHtml = buildEmailHtml({
      heading: 'Meeting Starting Soon',
      title: room.title,
      description: room.description,
      details: [
        `Starts at: ${scheduledStr}`,
        `Duration: ${room.duration} min`,
        `Host: ${room.hostName}`,
      ],
      joinUrl,
      joinLabel: 'Join Meeting',
    });
    smsText = `Reminder: "${room.title}" starts at ${scheduledStr}. Join: ${joinUrl}`;
  }

  let emailsSent = 0;
  let smsSent = 0;
  let inAppSent = 0;

  // Fire all notifications concurrently (best-effort, never throw)
  const tasks = users.map(async (user) => {
    // In-app notification
    try {
      await Notification.create({
        recipient: user._id,
        title: inAppTitle,
        message: inAppMessage,
        type: inAppType,
        link: joinUrl,
      });
      inAppSent++;
    } catch (_) { /* best effort */ }

    // Email
    if (user.email) {
      try {
        const { sendEmail } = require('../config/mailer');
        await sendEmail({ to: user.email, subject, html: emailHtml });
        emailsSent++;
      } catch (_) { /* best effort */ }
    }

    // SMS
    const notifyTo = user.email || user.phone;
    if (notifyTo) {
      try {
        const { sendSMS } = require('../config/africastalking');
        await sendSMS(notifyTo, smsText);
        smsSent++;
      } catch (_) { /* best effort */ }
    }
  });

  await Promise.allSettled(tasks);

  console.log(
    `[Meeting Notify] ${event} for "${room.title}": `
    + `${emailsSent} emails, ${smsSent} SMS, ${inAppSent} in-app`,
  );

  return { emailsSent, smsSent, inAppSent };
}

module.exports = { notifyParticipants, buildEmailHtml };
