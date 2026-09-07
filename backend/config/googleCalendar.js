// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
//
// ICS Calendar generation — stores .ics files in MinIO.
// Generates .ics files that users can import into any calendar app
// (Google Calendar, Apple Calendar, Outlook, etc.).
const {
  uploadBuffer, deleteObject, fileUrl: _fileUrl, MINIO_BUCKET,
} = require('./cloudinary');

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

/**
 * Format a Date to iCalendar UTC timestamp (YYYYMMDDTHHMMSSZ).
 */
function formatICSDate(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Generate an ICS file for a meeting, upload to MinIO, and return its URL.
 * @param {Object} room - Meeting document
 * @returns {Promise<string|null>} URL to the .ics file, or null on error
 */
async function generateICS(room) {
  try {
    if (!room.scheduledAt) return null;

    const start = new Date(room.scheduledAt);
    const end = new Date(start.getTime() + (room.duration || 60) * 60 * 1000);
    const joinUrl = `${CLIENT_URL}/admin/meetings?join=${room._id}`;
    const uid = `${room._id}@pclsolutions.co.ke`;

    const description = [
      room.description || '',
      '',
      `Host: ${room.hostName}`,
      `Duration: ${room.duration} min`,
      `Department: ${room.department || 'All'}`,
      '',
      `Join Meeting: ${joinUrl}`,
    ].filter(Boolean).join('\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//PCL//Meeting Scheduler//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTART:${formatICSDate(start)}`,
      `DTEND:${formatICSDate(end)}`,
      `SUMMARY:${(room.title || 'Meeting').replace(/,/g, '\\,')}`,
      `DESCRIPTION:${description}`,
      `URL:${joinUrl}`,
      'STATUS:CONFIRMED',
      'BEGIN:VALARM',
      'TRIGGER:-PT10M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Meeting starting in 10 minutes',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\\r\\n');

    const objectName = `calendar/meeting-${room._id}.ics`;
    const result = await uploadBuffer(MINIO_BUCKET, objectName, Buffer.from(ics), 'text/calendar');
    console.log(`[ICS] Generated calendar file: ${objectName}`);
    return result.url;
  } catch (err) {
    console.error(`[ICS] Error generating calendar file: ${err.message}`);
    return null;
  }
}

/**
 * Generate ICS content as a Buffer (for direct download — no MinIO upload).
 * @param {Object} room - Meeting document
 * @returns {Promise<Buffer|null>} Buffer with ICS content, or null on error
 */
async function generateICSBuffer(room) {
  try {
    if (!room.scheduledAt) return null;

    const start = new Date(room.scheduledAt);
    const end = new Date(start.getTime() + (room.duration || 60) * 60 * 1000);
    const joinUrl = `${CLIENT_URL}/admin/meetings?join=${room._id}`;
    const uid = `${room._id}@pclsolutions.co.ke`;

    const description = [
      room.description || '',
      '',
      `Host: ${room.hostName}`,
      `Duration: ${room.duration} min`,
      `Department: ${room.department || 'All'}`,
      '',
      `Join Meeting: ${joinUrl}`,
    ].filter(Boolean).join('\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//PCL//Meeting Scheduler//EN',
      'CALSCALE:GREGOR',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTART:${formatICSDate(start)}`,
      `DTEND:${formatICSDate(end)}`,
      `SUMMARY:${(room.title || 'Meeting').replace(/,/g, '\\,')}`,
      `DESCRIPTION:${description}`,
      `URL:${joinUrl}`,
      'STATUS:CONFIRMED',
      'BEGIN:VALARM',
      'TRIGGER:-PT10M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Meeting starting in 10 minutes',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    return Buffer.from(ics);
  } catch (err) {
    console.error(`[ICS] Error generating ICS buffer: ${err.message}`);
    return null;
  }
}

/**
 * Delete a previously generated ICS file from MinIO.
 * @param {string} roomId - Meeting document ID
 */
async function deleteICS(roomId) {
  await deleteObject(MINIO_BUCKET, `calendar/meeting-${roomId}.ics`);
}

/**
 * Check if calendar integration is configured.
 * Always returns true — ICS files need no external API.
 */
function getConfigured() {
  return true;
}

// Stubs for API compatibility — ICS files replace these operations.
async function createCalendarEvent(room) {
  return generateICS(room);
}

async function updateCalendarEvent(eventId, room) {
  return generateICS(room);
}

async function deleteCalendarEvent(eventId) {
  if (eventId) await deleteICS(eventId);
  return true;
}

async function addAttendees(_eventId, _emails) {
  return true;
}

module.exports = {
  getConfigured,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  addAttendees,
  generateICS,
  generateICSBuffer,
  deleteICS,
};
