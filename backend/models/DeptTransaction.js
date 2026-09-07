// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
const mongoose = require('mongoose');

const DeptTransactionSchema = new mongoose.Schema({
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
  departmentSlug: { type: String, required: true },
  type: { type: String, enum: ['income', 'expense'], required: true },
  category: { type: String, required: true },
  description: { type: String, required: true },
  amount: { type: Number, required: true, min: 0 },
  paymentMethod: { type: String, enum: ['mpesa', 'cash', 'bank', 'other'], default: 'cash' },
  mpesaRef: String,
  date: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  tags: [String],
}, { timestamps: true });

DeptTransactionSchema.index({ department: 1, date: -1 });
DeptTransactionSchema.index({ departmentSlug: 1, type: 1 });
// Covering index for /finance/breakdown aggregation (type + date filter, group by slug, sum amount)
DeptTransactionSchema.index({
  type: 1, date: -1, departmentSlug: 1, amount: 1,
});

module.exports = mongoose.model('DeptTransaction', DeptTransactionSchema);
