// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// Meeting Model — LiveKit room management and scheduling

const mongoose = require('mongoose');

const MeetingSchema = new mongoose.Schema({
  roomName: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  scheduledAt: { type: Date, default: null },
  duration: { type: Number, default: 60 }, // minutes
  department: { type: String, default: null },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isRecurring: { type: Boolean, default: false },
  recurringPattern: { type: String, default: null }, // 'daily', 'weekly', 'monthly'
  host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  hostName: { type: String, required: true },
  status: {
    type: String,
    enum: ['SCHEDULED', 'ACTIVE', 'ENDED', 'CANCELLED'],
    default: 'SCHEDULED',
  },
  startedAt: { type: Date, default: null },
  endedAt: { type: Date, default: null },
  recordingUrl: { type: String, default: null },
  recordingEgressId: { type: String, default: null },
  isRecording: { type: Boolean, default: false },
  calendarEventId: { type: String, default: null }, // Google Calendar event ID
  notes: { type: String, default: '' },
}, { timestamps: true });

MeetingSchema.index({ scheduledAt: 1 });
MeetingSchema.index({ host: 1 });
MeetingSchema.index({ status: 1 });

module.exports = mongoose.model('Meeting', MeetingSchema);
