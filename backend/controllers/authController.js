// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const RegisteredDevice = require('../models/RegisteredDevice');
const ActiveSession = require('../models/ActiveSession');
const { recordFailure, recordSuccess } = require('../middleware/bruteForce');

// Sign token — algorithm explicitly pinned to HS256, includes jti for session tracking
const signToken = (user, jti) => jwt.sign(
  {
    id: user._id,
    email: user.email,
    role: user.role,
    departmentId: user.department?._id || user.department || null,
    departmentSlug: user.departmentSlug || null,
    isOwner: user.isOwner || false,
    jti, // JWT ID for session invalidation
  },
  process.env.JWT_SECRET,
  {
    expiresIn: process.env.JWT_EXPIRE || '8h',
    algorithm: 'HS256',
  },
);

// Validate email format
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// SHA256 hash for device fingerprints
const hashFingerprint = (fp) => crypto.createHash('sha256').update(fp).digest('hex');

// ── Cookie configuration ────────────────────────────────────────────────────
const isProduction = process.env.NODE_ENV === 'production';

const JWT_COOKIE_OPTIONS = {
  httpOnly: true,        // Not accessible via JavaScript (XSS prevention)
  secure: isProduction,  // HTTPS only in production
  sameSite: 'lax',       // CSRF protection — sent on top-level navigations
  path: '/',
  maxAge: 8 * 60 * 60 * 1000, // 8 hours (matches JWT_EXPIRE)
};

const JWT_COOKIE_NAME = 'pcl_token';

/**
 * Set JWT in httpOnly cookie on the response.
 * Also returns the token in the JSON body for backward compatibility
 * with API clients (mobile apps, Postman, etc.).
 */
function setJwtCookie(res, token) {
  res.cookie(JWT_COOKIE_NAME, token, JWT_COOKIE_OPTIONS);
}

/**
 * Clear JWT cookie on logout/session expiry.
 */
function clearJwtCookie(res) {
  res.clearCookie(JWT_COOKIE_NAME, { path: '/' });
}

exports.verifyToken = async (req, res, next) => {
  try {
    const { token, userId } = req.body;

    if (!token || !userId) {
      return res.status(400).json({ message: 'Token and user ID required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const isTokenValid = hashedToken === user.passwordResetToken;
    const isTokenExpired = user.tokenExpiry && user.tokenExpiry < new Date();

    if (!isTokenValid || isTokenExpired) {
      return res.status(400).json({
        message: 'Invalid or expired token',
        valid: false,
      });
    }

    res.json({
      valid: true,
      message: 'Token is valid',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.setPassword = async (req, res, next) => {
  try {
    const { token, userId, password } = req.body;

    if (!token || !userId || !password) {
      return res.status(400).json({ message: 'Token, user ID, and password required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const isTokenValid = hashedToken === user.passwordResetToken;
    const isTokenExpired = user.tokenExpiry && user.tokenExpiry < new Date();

    if (!isTokenValid || isTokenExpired) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.tokenExpiry = undefined;
    user.isActive = true;
    user.isEmailVerified = true;

    await user.save();

    res.json({
      message: 'Password set successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) { next(err); }
};

exports.register = async (req, res, next) => {
  try {
    const {
      name, email, password, role, department, departmentSlug, isOwner,
    } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ message: 'Name must be at least 2 characters' });
    }
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ message: 'Valid email address required' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    if (role === 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role,
      department,
      departmentSlug,
      isOwner,
    });

    const jti = crypto.randomUUID();
    const token = signToken(user, jti);
    setJwtCookie(res, token);

    res.status(201).json({
      token, // Also in body for API clients
      user: {
        id: user._id, name: user.name, email: user.email, role: user.role, departmentSlug: user.departmentSlug,
      },
    });
  } catch (err) { next(err); }
};

// ── Enhanced Login with Device Checking + Session Kick ──────────────────
exports.login = async (req, res, next) => {
  try {
    const {
      email, password, deviceFingerprint, deviceName,
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: 'Invalid input' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select('+password')
      .populate('department', 'name slug');

    // Timing-attack prevention
    const dummyHash = '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012345';
    const passwordMatch = user
      ? await user.matchPassword(password)
      : await require('bcryptjs').compare(password, dummyHash);

    if (!user || !passwordMatch) {
      // Record failed attempt for brute-force protection
      const ip = req._bruteForceIp || req.ip || 'unknown';
      recordFailure(ip);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Account deactivated — contact your administrator' });
    }

    // ── Device fingerprint check + auto-registration ─────────────────────
    let deviceHash = null;

    if (deviceFingerprint) {
      deviceHash = hashFingerprint(deviceFingerprint);

      // Check if this user has ANY registered devices
      const totalDevices = await RegisteredDevice.countDocuments({ admin: user._id, isActive: true });

      if (totalDevices === 0) {
        // First device — auto-register it
        await RegisteredDevice.create({
          admin: user._id,
          deviceHash,
          deviceName: deviceName || 'First Device',
          lastSeenIp: req.ip,
          lastSeenAt: new Date(),
          userAgent: req.headers['user-agent'] || '',
        });
        console.log(`[DEVICE] Auto-registered first device for ${user.email}`);
      } else if (totalDevices < RegisteredDevice.MAX_DEVICES) {
        // User has fewer than MAX_DEVICES registered — check if this is already registered
        const existingDevice = await RegisteredDevice.findOne({
          admin: user._id,
          deviceHash,
          isActive: true,
        });

        if (existingDevice) {
          // Device already registered — update last seen
          existingDevice.lastSeenAt = new Date();
          existingDevice.lastSeenIp = req.ip;
          existingDevice.userAgent = req.headers['user-agent'] || '';
          await existingDevice.save();
        } else {
          // New device — auto-register it (within limit)
          await RegisteredDevice.create({
            admin: user._id,
            deviceHash,
            deviceName: deviceName || `Device ${totalDevices + 1}`,
            lastSeenIp: req.ip,
            lastSeenAt: new Date(),
            userAgent: req.headers['user-agent'] || '',
          });
          console.log(`[DEVICE] Auto-registered device ${totalDevices + 1}/${RegisteredDevice.MAX_DEVICES} for ${user.email}`);
        }
      } else {
        // User has MAX_DEVICES registered — check if THIS device is one of them
        const device = await RegisteredDevice.findOne({
          admin: user._id,
          deviceHash,
          isActive: true,
        });

        if (!device) {
          return res.status(403).json({
            message: `Device limit reached (${RegisteredDevice.MAX_DEVICES} max). Contact your Super Admin to register a new device.`,
            code: 'DEVICE_NOT_REGISTERED',
          });
        }

        // Update device last seen
        device.lastSeenAt = new Date();
        device.lastSeenIp = req.ip;
        device.userAgent = req.headers['user-agent'] || '';
        await device.save();
      }
    }

    // ── Kick existing sessions (enforce 1 concurrent session) ────────────
    if (deviceHash) {
      // Delete ALL existing sessions for this user (kicks other devices)
      await ActiveSession.deleteMany({ admin: user._id });

      // Create new session
      const jti = crypto.randomUUID();
      const expiresIn = parseInt(process.env.JWT_EXPIRE_HOURS || '8', 10);
      const expiresAt = new Date(Date.now() + expiresIn * 60 * 60 * 1000);

      await ActiveSession.create({
        admin: user._id,
        deviceHash,
        jti,
        userAgent: req.headers['user-agent'] || '',
        ip: req.ip,
        expiresAt,
      });

      user.lastLogin = new Date();
      await user.save({ validateBeforeSave: false });

      // Reset brute-force counter on successful login
      const successIp = req._bruteForceIp || req.ip || 'unknown';
      recordSuccess(successIp);

      const token = signToken(user, jti);
      setJwtCookie(res, token);

      return res.json({
        token, // Also in body for backward compat
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          departmentSlug: user.departmentSlug,
          isOwner: user.isOwner,
        },
        session: { jti, expiresAt },
        mustChangePassword: user.mustChangePassword || false,
      });
    }

    // ── Fallback: no device fingerprint (backward compatible) ─────────────
    // Also kick old sessions and create a new one (same as device path)
    await ActiveSession.deleteMany({ admin: user._id });

    const jti = crypto.randomUUID();
    const expiresIn = parseInt(process.env.JWT_EXPIRE_HOURS || '8', 10);
    const expiresAt = new Date(Date.now() + expiresIn * 60 * 60 * 1000);

    await ActiveSession.create({
      admin: user._id,
      deviceHash: 'no-fingerprint',
      jti,
      userAgent: req.headers['user-agent'] || '',
      ip: req.ip,
      expiresAt,
    });

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = signToken(user, jti);
    setJwtCookie(res, token);

    res.json({
      token, // Also in body for backward compat
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        departmentSlug: user.departmentSlug,
        isOwner: user.isOwner,
      },
      mustChangePassword: user.mustChangePassword || false,
    });
  } catch (err) { next(err); }
};

// ── Logout ──────────────────────────────────────────────────────────────
exports.logout = async (req, res, next) => {
  try {
    // Clear JWT cookie
    clearJwtCookie(res);

    // Kill active session if jti is available
    const token = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1]
      : null;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
        if (decoded.jti) {
          await ActiveSession.deleteOne({ jti: decoded.jti });
        }
      } catch { /* token may be expired — that's fine */ }
    }

    res.json({ message: 'Logged out successfully' });
  } catch (err) { next(err); }
};

// ── Forced password change (first login) ──────────────────────────────
exports.changeFirstPassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.mustChangePassword) {
      return res.status(400).json({ message: 'Password change not required' });
    }

    // Verify current (temporary) password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Validate new password
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters' });
    }

    if (newPassword === currentPassword) {
      return res.status(400).json({ message: 'New password must be different from the temporary password' });
    }

    // Update password and clear flag
    user.password = newPassword;
    user.mustChangePassword = false;
    user.temporaryPassword = undefined;
    await user.save();

    res.json({ message: 'Password changed successfully. You can now access the admin panel.' });
  } catch (err) { next(err); }
};

exports.getMe = async (req, res, next) => {
  try {
    // protect middleware already fetched and populated the user — no duplicate query needed
    const { password, ...user } = req.user.toObject();
    res.json(user);
  } catch (err) { next(err); }
};
