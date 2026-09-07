// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
const mongoose = require('mongoose');

const JobCardSchema = new mongoose.Schema({
  jobNumber: { type: String, unique: true },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
  clientName: { type: String, required: true },
  clientPhone: { type: String, required: true },
  clientEmail: { type: String, lowercase: true },
  deviceType: { type: String, required: true },
  deviceBrand: String,
  serialNumber: String,
  faultDescription: { type: String, required: true },
  assignedTechnician: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: {
    type: String,
    enum: ['received', 'diagnosing', 'awaiting-parts', 'in-repair', 'completed', 'collected', 'cancelled'],
    default: 'received',
  },
  estimatedCost: Number,
  finalCost: Number,
  partsUsed: [{ name: String, cost: Number, quantity: Number }],
  warrantyDays: { type: Number, default: 0 },
  warrantyExpiry: Date,
  notes: String,
  completedAt: Date,
  collectedAt: Date,
  paymentStatus: { type: String, enum: ['unpaid', 'paid'], default: 'unpaid' },
  mpesaRef: String,
  // Phase 9 market research, Tier 1 #3 — lets a customer opt into WhatsApp
  // for status updates instead of SMS. Defaults to SMS since it always
  // works without any extra account setup (see config/africastalking.js).
  notifyChannel: { type: String, enum: ['sms', 'whatsapp', 'both'], default: 'sms' },
}, { timestamps: true });

JobCardSchema.pre('save', async function (next) {
  if (!this.jobNumber) {
    const count = await mongoose.model('JobCard').countDocuments();
    this.jobNumber = `JC-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('JobCard', JobCardSchema);
