// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: {
    type: String, required: true, unique: true, lowercase: true,
  },
  phone: { type: String, default: null }, // optional — for SMS notifications
  password: {
    type: String, required: true, minlength: 6, select: false,
  },
  role: {
    type: String,
    enum: ['SUPER_ADMIN', 'SITE_MANAGER', 'DEPT_HEAD_OWNER', 'STAFF', 'admin', 'staff'], // legacy support
    default: 'STAFF',
  },
  siteManagerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // Links to SUPER_ADMIN who manages this site manager
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
  departmentSlug: { type: String, default: null },
  isOwner: { type: Boolean, default: false },
  superAdminLocked: { type: Boolean, default: false }, // prevents modification via standard endpoint
  isActive: { type: Boolean, default: true },
  lastLogin: Date,
  isEmailVerified: { type: Boolean, default: false }, // Track if email is verified
  passwordResetToken: { type: String, default: null }, // For password reset/initial setup
  tokenExpiry: { type: Date, default: null }, // Token expiry for password reset
  mustChangePassword: { type: Boolean, default: false }, // Forces password change on first login
  temporaryPassword: { type: String, default: null, select: false }, // Stores the initial password for display
}, { timestamps: true });

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

UserSchema.methods.matchPassword = function (entered) {
  return bcrypt.compare(entered, this.password);
};

module.exports = mongoose.model('User', UserSchema);
