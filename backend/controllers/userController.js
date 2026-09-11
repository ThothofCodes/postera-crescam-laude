// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
const User = require('../models/User');
const Department = require('../models/Department');

const isSuperAdmin = (user) => user.role === 'SUPER_ADMIN';
const isDeptHead = (user) => user.role === 'DEPT_HEAD_OWNER';

exports.getUsers = async (req, res, next) => {
  try {
    const { role, departmentSlug } = req.query;
    const filter = {};

    // Dept heads can only see users in their own department
    if (isDeptHead(req.user)) {
      filter.departmentSlug = req.user.departmentSlug;
    } else {
      if (role) filter.role = role;
      if (departmentSlug) filter.departmentSlug = departmentSlug;
    }

    const users = await User.find(filter)
      .populate('department', 'name slug')
      .sort('name')
      .select('-password');
    res.json(users);
  } catch (err) { next(err); }
};

exports.createUser = async (req, res, next) => {
  try {
    const {
      name, email, password, role, departmentSlug, isOwner, mustChangePassword,
    } = req.body;

    // Block SUPER_ADMIN creation entirely
    if (role === 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Cannot create SUPER_ADMIN via this endpoint' });
    }

    // Dept heads can only create STAFF (not other DEPT_HEAD_OWNERs) in their own dept
    if (isDeptHead(req.user)) {
      if (role && role !== 'STAFF') {
        return res.status(403).json({ message: 'Department heads can only create STAFF accounts' });
      }
      if (departmentSlug && departmentSlug !== req.user.departmentSlug) {
        return res.status(403).json({ message: 'You can only add staff to your own department' });
      }
    }

    // Resolve department
    const targetSlug = isDeptHead(req.user) ? req.user.departmentSlug : (departmentSlug || null);
    let department = null;
    if (targetSlug) {
      const dept = await Department.findOne({ slug: targetSlug });
      if (!dept) return res.status(400).json({ message: `Department '${targetSlug}' not found` });
      department = dept._id;
    }

    const finalRole = isDeptHead(req.user) ? 'STAFF' : (role || 'STAFF');

    // Create user with temporary password if mustChangePassword is true
    const user = await User.create({
      name,
      email,
      password,
      role: finalRole,
      department,
      departmentSlug: targetSlug,
      isOwner: isSuperAdmin(req.user) ? (isOwner || false) : false,
      mustChangePassword: mustChangePassword || false,
      temporaryPassword: mustChangePassword ? password : null,
    });

    res.status(201).json({
      id: user._id,
      name,
      email,
      role: user.role,
      departmentSlug: user.departmentSlug,
      mustChangePassword: user.mustChangePassword,
    });
  } catch (err) { next(err); }
};

exports.updateUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.superAdminLocked) return res.status(403).json({ message: 'This account cannot be modified' });

    // Dept heads can only update STAFF in their own dept
    if (isDeptHead(req.user)) {
      if (user.departmentSlug !== req.user.departmentSlug) {
        return res.status(403).json({ message: 'You can only manage staff in your own department' });
      }
      if (user.role !== 'STAFF') {
        return res.status(403).json({ message: 'You can only manage STAFF accounts' });
      }
      // Dept heads cannot promote to DEPT_HEAD_OWNER or higher
      if (req.body.role && req.body.role !== 'STAFF') {
        return res.status(403).json({ message: 'You cannot change a staff member\'s role above STAFF' });
      }
    }

    const {
      name, role, departmentSlug, isOwner, isActive,
    } = req.body;
    if (role === 'SUPER_ADMIN') return res.status(403).json({ message: 'Cannot assign SUPER_ADMIN role' });

    if (isSuperAdmin(req.user) && departmentSlug) {
      const dept = await Department.findOne({ slug: departmentSlug });
      if (dept) { user.department = dept._id; user.departmentSlug = departmentSlug; }
    }
    if (name !== undefined) user.name = name;
    if (role !== undefined && isSuperAdmin(req.user)) user.role = role;
    if (isOwner !== undefined && isSuperAdmin(req.user)) user.isOwner = isOwner;
    if (isActive !== undefined) user.isActive = isActive;
    await user.save();

    res.json({
      id: user._id, name: user.name, email: user.email, role: user.role, departmentSlug: user.departmentSlug,
    });
  } catch (err) { next(err); }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('+temporaryPassword');
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.superAdminLocked) return res.status(403).json({ message: 'Cannot reset Super Admin password via API' });

    // Dept heads can only reset passwords for their own dept's STAFF
    if (isDeptHead(req.user)) {
      if (user.departmentSlug !== req.user.departmentSlug || user.role !== 'STAFF') {
        return res.status(403).json({ message: 'You can only reset passwords for your own department staff' });
      }
    }

    const { password, mustChangePassword } = req.body;
    user.password = password;

    // If mustChangePassword is true, set the temporary password for display
    if (mustChangePassword) {
      user.mustChangePassword = true;
      user.temporaryPassword = password;
    } else {
      user.mustChangePassword = false;
      user.temporaryPassword = undefined;
    }

    await user.save();
    res.json({ message: 'Password reset successfully', mustChangePassword: user.mustChangePassword });
  } catch (err) { next(err); }
};

exports.deactivateUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.superAdminLocked) return res.status(403).json({ message: 'Cannot deactivate Super Admin' });

    // Dept heads can only deactivate their own dept's STAFF
    if (isDeptHead(req.user)) {
      if (user.departmentSlug !== req.user.departmentSlug || user.role !== 'STAFF') {
        return res.status(403).json({ message: 'You can only deactivate staff in your own department' });
      }
    }

    user.isActive = false;
    await user.save();
    res.json({ message: 'User deactivated' });
  } catch (err) { next(err); }
};

// ── SUPER_ADMIN can change SITE_MANAGER email ───────────────────────
exports.changeSiteManagerEmail = async (req, res, next) => {
  try {
    // Only SUPER_ADMIN can change SITE_MANAGER email
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Only Super Admin can change Site Manager email' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Only allow changing email for SITE_MANAGER role
    if (user.role !== 'SITE_MANAGER') {
      return res.status(400).json({ message: 'Can only change email for Site Manager accounts' });
    }

    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ message: 'Valid email address required' });
    }

    // Check if email is already taken
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser && existingUser._id.toString() !== user._id.toString()) {
      return res.status(400).json({ message: 'Email address already in use' });
    }

    user.email = email.toLowerCase().trim();
    await user.save();

    res.json({ 
      message: 'Site Manager email updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      }
    });
  } catch (err) { next(err); }
};
