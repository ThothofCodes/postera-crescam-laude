// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
const mongoose = require('mongoose');

const GovDocumentSchema = new mongoose.Schema({
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
  ticketNumber: { type: String, unique: true },
  clientName: { type: String, required: true },
  clientPhone: { type: String, required: true },
  clientEmail: { type: String, lowercase: true },
  clientIdNumber: String, // encrypted in production
  documentType: {
    type: String,
    enum: ['ecitizen', 'kra-pin', 'ntsa', 'nhif', 'nssf', 'passport', 'good-conduct', 'business-reg', 'other'],
    required: true,
  },
  description: String,
  status: {
    type: String,
    enum: ['received', 'processing', 'awaiting-client', 'completed', 'collected', 'cancelled'],
    default: 'received',
  },
  governmentFee: { type: Number, default: 0 },
  serviceFee: { type: Number, default: 0 },
  totalFee: Number,
  paymentStatus: { type: String, enum: ['unpaid', 'paid'], default: 'unpaid' },
  mpesaRef: String,
  expectedDate: Date,
  completedAt: Date,
  collectedAt: Date,
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes: String,
}, { timestamps: true });

GovDocumentSchema.pre('save', async function (next) {
  if (!this.ticketNumber) {
    const count = await mongoose.model('GovDocument').countDocuments();
    this.ticketNumber = `GOV-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
  }
  if (!this.totalFee) this.totalFee = (this.governmentFee || 0) + (this.serviceFee || 0);
  next();
});

module.exports = mongoose.model('GovDocument', GovDocumentSchema);
