// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// Socket.io server — real-time layer for notifications, sessions, payments, tickets, and chat
const jwt = require('jsonwebtoken');
const ChatMessage = require('./models/ChatMessage');
const { presenceManager } = require('./socket/presence.manager'); // Use the centralized presence manager

let _io = null;

// ── FIX (Continuity Audit, Part One, Exhibit A) ────────────────────────────
// Roles that may answer chat / count toward presence. This used to be a
// brittle `role.includes('admin')` substring check, which silently failed
// for 'DEPT_HEAD_OWNER' and 'STAFF' — meaning only the literal Super Admin
// could ever be "the admin" for chat, no matter how many department heads
// or staff were logged in. It is now a real check against the actual role
// enum defined on the User model.
const ADMIN_CAPABLE_ROLES = ['SUPER_ADMIN', 'DEPT_HEAD_OWNER', 'STAFF', 'admin', 'staff'];

function isAdminRole(role) {
  if (!role) return false;
  return ADMIN_CAPABLE_ROLES.includes(role.toString());
}

// SUPER_ADMIN is the only role with the highest clearance level in this
// system — their presence satisfies every department's beacon, and (per
// superAdminGuard in middleware/auth.js) they are identity-locked to the
// account configured in SUPER_ADMIN_EMAIL.
function isSuperAdminRole(role) {
  return role === 'SUPER_ADMIN';
}

// Strip a "Bearer " prefix if a client sends one. Socket.IO's auth payload
// is not an HTTP header — it should carry the raw token — but some client
// hooks historically mirrored the HTTP convention and prefixed it anyway,
// which made jwt.verify() throw "jwt malformed" on every single admin
// connection and silently demote it to an anonymous visitor. Stripping it
// here (rather than only relying on every client to send it correctly)
// means the server is robust either way.
function extractToken(socket) {
  const raw = socket.handshake.auth?.token
    || socket.handshake.headers?.authorization;
  if (!raw) return null;
  return raw.startsWith('Bearer ') ? raw.slice(7) : raw;
}

/**
 * Initialise Socket.io on an existing http.Server.
 * Call once from server.js after http.createServer(app).
 */
function initSocket(httpServer) {
  const { Server } = require('socket.io');

  _io = new Server(httpServer, {
    cors: {
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        const isDev = process.env.NODE_ENV !== 'production';
        if (isDev && /^https?:\/\/localhost(:\d+)?$/.test(origin)) return cb(null, true);
        if (isDev && /^https?:\/\/\d+\.\d+\.\d+\.\d+(:\d+)?$/.test(origin)) return cb(null, true);
        // In development, allow known tunnel domains only (not any HTTPS origin)
        if (isDev && /^https?:\/\/[\w.-]+\.ngrok\.io(:\d+)?$/.test(origin)) return cb(null, true);
        if (isDev && /^https?:\/\/[\w-]+\.loca\.lt(:\d+)?$/.test(origin)) return cb(null, true);
        const allowed = (process.env.CLIENT_URL || 'http://localhost:3000').split(',').map((o) => o.trim());
        if (allowed.includes(origin)) return cb(null, true);
        console.warn(`[SOCKET] CORS blocked: ${origin}`);
        cb(new Error('CORS'), false);
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Use polling first then upgrade — works behind proxies (PythonAnywhere)
    transports: ['polling', 'websocket'],
    pingTimeout: 20000,
    pingInterval: 25000,
  });

  // ── Auth middleware ──────────────────────────────────────
  _io.use((socket, next) => {
    try {
      const token = extractToken(socket);

      // For public chat, we allow unauthenticated connections
      if (!token) {
        socket.isPublic = true;
        socket.data = { role: 'visitor', authenticated: false };
        return next();
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
      socket.user = decoded; // { id, role, email, departmentId, departmentSlug, isOwner }
      socket.data = {
        userId: decoded.id,
        role: decoded.role,
        departmentSlug: decoded.departmentSlug || null,
        authenticated: true,
      };
      next();
    } catch (err) {
      // Token was present but invalid/expired/malformed — log it once so this
      // failure mode is visible in server logs instead of silently degrading
      // every rejected admin to "visitor" with no trace.
      console.warn(`[CHAT] Socket auth rejected (${err.name}: ${err.message}) — falling back to visitor mode for socket ${socket.id}`);
      socket.isPublic = true;
      socket.data = { role: 'visitor', authenticated: false };
      next();
    }
  });

  // ── Connection handler ───────────────────────────────────
  _io.on('connection', (socket) => {
    console.log(`[CHAT] Connected: ${socket.id} role=${socket.data?.role || socket.user?.role || 'visitor'}`);

    // ── ADMIN FLOW ────────────────────────────────────────────────
    const userRole = socket.user?.role || socket.data?.role;
    const userId = socket.user?.id || socket.data?.userId;
    const departmentSlug = socket.user?.departmentSlug || socket.data?.departmentSlug || null;
    const isSuperAdmin = isSuperAdminRole(userRole);

    if (isAdminRole(userRole)) {
      // Register presence IMMEDIATELY on connect, tagged with department +
      // clearance level so dept-scoped presence (Pulse) works correctly.
      presenceManager.adminConnected(userId, socket.id, {
        departmentSlug,
        isSuperAdmin,
        role: userRole,
        name: socket.user?.email || null,
      });
      socket.isAdmin = true;

      // Join admin room (global) and, if they belong to one, their own
      // department's admin room. SUPER_ADMIN doesn't need a department room —
      // their highest-clearance status already covers every department via
      // presenceManager.isAnyAdminOnlineForDept().
      socket.join('admin-room');
      socket.join('admin:global'); // For real-time payment notifications
      socket.join('public-chat'); // Also join public-chat so admin:status events reach the admin's own client
      if (departmentSlug) socket.join(`admin-room:${departmentSlug}`);

      // Broadcast to ALL visitors that admin status may have changed
      // (since admin availability affects overall status)
      // FIXED: Ensure the status is broadcast immediately when an admin connects
      const currentAdminStatus = presenceManager.isAnyAdminOnline();
      _io.to('public-chat').emit('admin:status', { online: currentAdminStatus });

      // Department-scoped beacon update — opt-in event for clients that pass
      // a departmentSlug and care about a specific department's coverage
      // rather than the global flag.
      if (departmentSlug) {
        _io.to(`public-chat:${departmentSlug}`).emit('admin:status:dept', {
          departmentSlug,
          online: presenceManager.isAnyAdminOnlineForDept(departmentSlug),
        });
      }

      // Notify pending callback clients
      const pending = presenceManager.getPendingCallbacks();
      pending.forEach(([clientSocketId, _clientData]) => {
        const clientSocket = _io.sockets.sockets.get(clientSocketId);
        if (clientSocket?.connected) {
          clientSocket.emit('admin:now-available', {
            message: 'Support is now available. Click to start your chat.',
          });
          presenceManager.removePendingCallback(clientSocketId);
        }
      });

      // Admin heartbeat - detect ghost connections
      const heartbeatInterval = setInterval(() => {
        if (!socket.connected) {
          clearInterval(heartbeatInterval);
          presenceManager.adminDisconnected(userId, socket.id);
          // Update admin status for all clients when admin disconnects
          // FIXED: Ensure the status is broadcast immediately when an admin disconnects
          const _latestAdminStatus = presenceManager.isAnyAdminOnline();
          _io.to('public-chat').emit('admin:status', { online: _latestAdminStatus });

          if (departmentSlug) {
            _io.to(`public-chat:${departmentSlug}`).emit('admin:status:dept', {
              departmentSlug,
              online: presenceManager.isAnyAdminOnlineForDept(departmentSlug),
            });
          }
        }
      }, 15000); // check every 15 seconds instead of 30 to be more responsive

      // Clear heartbeat interval on disconnect
      socket.on('disconnect', (reason) => {
        clearInterval(heartbeatInterval);
        // Remove admin socket from tracking
        presenceManager.adminDisconnected(userId, socket.id);

        // Check if any admins are still connected and available
        // FIXED: Ensure the status is broadcast immediately when an admin disconnects
        const _latestAdminStatus2 = presenceManager.isAnyAdminOnline();
        _io.to('public-chat').emit('admin:status', { online: _latestAdminStatus2 });

        if (departmentSlug) {
          _io.to(`public-chat:${departmentSlug}`).emit('admin:status:dept', {
            departmentSlug,
            online: presenceManager.isAnyAdminOnlineForDept(departmentSlug),
          });
        }

        console.log(`[CHAT] Admin disconnected: ${socket.id} reason=${reason}`);
      });

      // Send the admin their own online status directly so the UI reflects it immediately
      socket.emit('admin:status', { online: presenceManager.isAnyAdminOnline() });

      console.log(`[CHAT] Admin connected: ${socket.id} (user: ${userId}, role: ${userRole})`);

      // ── Admin chat functionality ───────────────────────────
      socket.on('admin-join-conversation', (conversationId) => {
        if (!socket.isAdmin) return;
        // Normalize conversation ID to ensure consistency
        const normalizedConversationId = conversationId.startsWith('conversation-')
          ? conversationId
          : `conversation-${conversationId}`;
        socket.join(normalizedConversationId);
      });

      socket.on('admin-send-message', async (data) => {
        if (!socket.isAdmin) {
          socket.emit('chat-error', { error: 'Unauthorized to send message' });
          return;
        }

        const { conversationId, message, guestId } = data;

        try {
          // Save message to database - ensure consistent conversation ID format
          const normalizedConversationId = conversationId.startsWith('conversation-')
            ? conversationId
            : `conversation-${conversationId}`;

          const chatMessage = new ChatMessage({
            conversationId: normalizedConversationId,
            senderId: socket.user.id,
            senderType: 'admin',
            message,
          });

          await chatMessage.save();

          // Broadcast to guest using the guest-specific room
          const normalizedGuestId = guestId.startsWith('guest-') ? guestId : `guest-${guestId}`;
          _io.to(normalizedGuestId).emit('new-chat-message', {
            conversationId: normalizedConversationId,
            message: {
              ...chatMessage.toObject(),
              // Add senderType to distinguish between admin and customer messages
              senderType: 'admin',
              direction: 'incoming', // From guest perspective, admin messages are incoming
            },
            guestId,
          });

          // Also emit to the conversation room in case guest is connected there
          _io.to(normalizedConversationId).emit('new-chat-message', {
            conversationId: normalizedConversationId,
            message: {
              ...chatMessage.toObject(),
              senderType: 'admin',
              direction: 'incoming', // From guest perspective, admin messages are incoming
            },
            guestId,
          });

          // Echo back to admin
          socket.emit('message-sent', {
            messageId: chatMessage._id,
            conversationId: normalizedConversationId,
            message: {
              ...chatMessage.toObject(),
              senderType: 'admin',
              direction: 'outgoing', // From admin perspective, admin messages are outgoing
            },
          });

          // Notify all other connected admin sockets about the new message
          _io.to('admin-room').except(socket.id).emit('new-chat-message', {
            conversationId: normalizedConversationId,
            message: {
              ...chatMessage.toObject(),
              senderType: 'admin',
              direction: 'outgoing', // Other admins see it as outgoing from the sender
            },
            guestId,
          });
        } catch (error) {
          console.error('Error sending admin message:', error);
          socket.emit('chat-error', { error: 'Failed to send message' });
        }
      });
    } else {
      // ── VISITOR FLOW ──────────────────────────────────────────────
      // Public user joins public chat room
      socket.join('public-chat');

      // Also join a guest-specific room for direct communication
      const guestId = socket.handshake.auth?.guestId || socket.id;
      const normalizedGuestId = guestId.startsWith('guest-') ? guestId : `guest-${guestId}`;
      socket.join(normalizedGuestId);

      // Create and join conversation room with consistent format
      const conversationId = `conversation-${normalizedGuestId}`;
      socket.join(conversationId);

      // Opt-in department scoping: if the visiting client passed a
      // departmentSlug (e.g. a customer on the Hardware Repair page),
      // join that department's room too so they get accurate per-department
      // beacon updates instead of only the global flag.
      const visitorDeptSlug = socket.handshake.auth?.departmentSlug || null;
      if (visitorDeptSlug) {
        socket.join(`public-chat:${visitorDeptSlug}`);
        socket.emit('admin:status:dept', {
          departmentSlug: visitorDeptSlug,
          online: presenceManager.isAnyAdminOnlineForDept(visitorDeptSlug),
        });
      }

      // Immediately tell this visitor the current admin status
      socket.emit('admin:status', { online: presenceManager.isAnyAdminOnline() });

      // Additionally emit department-specific status if applicable
      if (visitorDeptSlug) {
        socket.emit('admin:status:dept', {
          departmentSlug: visitorDeptSlug,
          online: presenceManager.isAnyAdminOnlineForDept(visitorDeptSlug),
        });
      }

      // Handle visitor requesting a callback
      socket.on('chat:request-callback', (data, ack) => {
        const {
          clientName, message, phone, departmentSlug: requestDept,
        } = data;

        if (!clientName || !message) {
          return ack?.({ success: false, error: 'Name and message are required.' });
        }

        presenceManager.addPendingCallback(socket.id, {
          clientName,
          message,
          phone,
          departmentSlug: requestDept || visitorDeptSlug || null,
        });
        console.log(`[CHAT] Callback queued for socket ${socket.id} (${clientName})`);

        // Check if admin becomes available while callback is pending
        if (presenceManager.isAnyAdminOnline()) {
          // Notify client that admin is now available
          socket.emit('admin:now-available', {
            message: 'Support is now available. Click to start your chat.',
          });
          // Remove from pending callbacks since admin is available
          presenceManager.removePendingCallback(socket.id);
        }

        ack?.({ success: true, message: 'We will notify you when support is available.' });
      });

      // Handle live chat message from visitor
      socket.on('chat-message', async (data) => {
        if (!socket.isPublic) {
          socket.emit('chat-error', { error: 'Unauthorized to send message' });
          return;
        }

        const { message, guestId: visitorGuestId } = data;

        // Check if admin is available before allowing chat
        if (!presenceManager.isAnyAdminOnline()) {
          socket.emit('chat-error', { error: 'No admin is currently available. Please submit a callback request.' });
          return;
        }

        try {
          // Save message to database with consistent conversation ID format
          const msgConversationId = `conversation-guest-${visitorGuestId}`;
          const chatMessage = new ChatMessage({
            conversationId: msgConversationId,
            senderId: visitorGuestId,
            senderType: 'customer',
            message,
          });

          await chatMessage.save();

          // Broadcast to all admins
          _io.to('admin-room').emit('new-chat-message', {
            conversationId: msgConversationId,
            message: {
              ...chatMessage.toObject(),
              direction: 'incoming', // From admin perspective, customer messages are incoming
            },
            guestId: visitorGuestId,
          });

          // Echo back to sender (but mark as outgoing from customer perspective)
          socket.emit('new-chat-message', {
            conversationId: msgConversationId,
            message: {
              ...chatMessage.toObject(),
              senderType: 'customer',
              direction: 'outgoing', // From customer perspective, their own messages are outgoing
            },
            guestId: visitorGuestId,
          });

          // Echo back to sender as confirmation
          socket.emit('message-sent', {
            messageId: chatMessage._id,
            conversationId: msgConversationId,
            message: {
              ...chatMessage.toObject(),
              senderType: 'customer',
              direction: 'outgoing',
            },
          });
        } catch (error) {
          console.error('Error sending visitor message:', error);
          socket.emit('chat-error', { error: 'Failed to send message' });
        }
      });

      // Clean up pending callback if visitor disconnects before admin came online
      socket.on('disconnect', (reason) => {
        presenceManager.removePendingCallback(socket.id);
        console.log(`[CHAT] Visitor disconnected: ${socket.id} reason=${reason}`);
      });
    }

    // ── Shared functionality ───────────────────────────────────────
    // ── Pulse — on-demand department beacon snapshot ──────────
    // Either an admin dashboard or a visitor page can ask "who's covering
    // which department right now?" by passing the department slugs it cares
    // about. SUPER_ADMIN presence is automatically reflected as covering
    // every slug requested (highest clearance level).
    socket.on('presence:get-beacons', (deptSlugs, ack) => {
      const slugs = Array.isArray(deptSlugs) ? deptSlugs.filter((s) => typeof s === 'string') : [];
      const beacons = presenceManager.getDepartmentBeacons(slugs);
      ack?.({ success: true, beacons });
    });

    // ── Phase 9 market research, Tier 1 #1 — public repair tracker ────
    // No auth required: anyone who knows a job number can watch it live
    // instead of polling. Joining costs nothing if the job doesn't exist —
    // the room simply never receives anything.
    socket.on('track:job', (jobNumber) => {
      if (typeof jobNumber === 'string' && jobNumber.trim()) {
        socket.join(`track:${jobNumber.trim().toUpperCase()}`);
      }
    });

    // ── Client joins a specific ticket room on request ─────
    socket.on('ticket:join', (ticketId) => {
      if (typeof ticketId === 'string' && /^[a-f0-9]{24}$/i.test(ticketId)) {
        socket.join(`ticket:${ticketId}`);
      }
    });
    socket.on('ticket:leave', (ticketId) => {
      socket.leave(`ticket:${ticketId}`);
    });

    // ── Broadcast ticket status updates to all admins ──────────
    socket.on('ticket:status-update', (data) => {
      if (data?._id && data?.status) {
        _io.to('admin-room').emit('ticket:status-update', data);
      }
    });

    // ── Payment status polling room ────────────────────────
    socket.on('payment:watch', (checkoutRequestId) => {
      if (typeof checkoutRequestId === 'string' && checkoutRequestId.length < 100) {
        socket.join(`payment:${checkoutRequestId}`);
      }
    });
    socket.on('payment:unwatch', (checkoutRequestId) => {
      socket.leave(`payment:${checkoutRequestId}`);
    });
  });

  // ── Broadcast admin status every 3 seconds to ensure consistency across networks ──
  // Department slugs are fetched dynamically from the DB (cached for 60s)
  let cachedSlugs = [];
  let lastSlugFetch = 0;

  async function getDepartmentSlugs() {
    const now = Date.now();
    if (cachedSlugs.length === 0 || now - lastSlugFetch > 60000) {
      try {
        const Department = require('./models/Department');
        const depts = await Department.find({ isActive: true }).select('slug').lean();
        cachedSlugs = depts.map((d) => d.slug);
        lastSlugFetch = now;
      } catch { /* DB not ready — use fallback */
        cachedSlugs = ['internet', 'webdev', 'playstation', 'repair', 'cybersecurity', 'govadmin'];
      }
    }
    return cachedSlugs;
  }

  setInterval(async () => {
    const online = presenceManager.isAnyAdminOnline();
    _io.to('public-chat').emit('admin:status', { online });

    // Broadcast to all department-specific rooms dynamically
    const slugs = await getDepartmentSlugs();
    slugs.forEach((deptSlug) => {
      _io.to(`public-chat:${deptSlug}`).emit('admin:status:dept', {
        departmentSlug: deptSlug,
        online: presenceManager.isAnyAdminOnlineForDept(deptSlug),
      });
    });
  }, 3000);

  return _io;
}

/** Get the io instance (throws if not initialised) */
function getIO() {
  if (!_io) throw new Error('Socket.io not initialised — call initSocket(httpServer) first');
  return _io;
}

// ── Emitter helpers used by controllers ──────────────────────────────────────

/**
 * Emit a notification to a specific user.
 * @param {string} userId   MongoDB ObjectId string
 * @param {object} payload  { _id, title, message, type, createdAt }
 */
function emitNotification(userId, payload) {
  try { getIO().to(`user:${userId}`).emit('notification:new', payload); } catch (e) { /* socket not ready yet — graceful no-op */ }
}

/**
 * Broadcast a notification to an entire department.
 * @param {string} deptSlug  e.g. 'playstation', 'repair'
 * @param {object} payload
 */
function emitDeptNotification(deptSlug, payload) {
  try { getIO().to(`dept:${deptSlug}`).emit('notification:new', payload); } catch (e) {}
}

/**
 * Broadcast a system-wide announcement (Super Admin only trigger).
 * @param {object} payload  { title, message, type: 'BROADCAST' }
 */
function emitBroadcast(payload) {
  try { getIO().emit('notification:broadcast', payload); } catch (e) {}
}

/**
 * Push M-Pesa payment result to clients watching that CheckoutRequestID.
 * Called from billingController.mpesaCallback and paymentController.
 * @param {string} checkoutRequestId
 * @param {object} payload  { success, invoiceId, amount, mpesaRef }
 */
function emitPaymentResult(checkoutRequestId, payload) {
  try {
    const io = getIO();
    // Emit to specific payment room (customer's browser)
    io.to(`payment:${checkoutRequestId}`).emit('payment:result', payload);
    // Emit to all admin rooms for real-time dashboard updates
    io.to('admin:global').emit('payment:new', { checkoutRequestId, ...payload, timestamp: Date.now() });
    io.to('admin-room').emit('payment:new', { checkoutRequestId, ...payload, timestamp: Date.now() });
    // Also emit to super admin room
    io.to('super:global').emit('payment:new', { checkoutRequestId, ...payload, timestamp: Date.now() });
  } catch (e) {}
}

/**
 * Push a new ticket thread message to all users watching that ticket.
 * @param {string} ticketId
 * @param {object} entry  { author, authorRole, message, createdAt }
 */
function emitTicketReply(ticketId, entry) {
  try { getIO().to(`ticket:${ticketId}`).emit('ticket:reply', entry); } catch (e) {}
}

/**
 * Push PlayStation session state change to the department room.
 * @param {string} deptSlug  'playstation'
 * @param {object} session   updated session document
 */
function emitSessionUpdate(deptSlug, session) {
  try { getIO().to(`dept:${deptSlug}`).emit('session:update', session); } catch (e) {}
}

/**
 * Push DB / system status to Super Admin global room.
 * @param {object} payload  { status, db, uptime }
 */
function emitSystemStatus(payload) {
  try { getIO().to('super:global').emit('system:status', payload); } catch (e) {}
}

module.exports = {
  initSocket,
  getIO,
  emitNotification,
  emitDeptNotification,
  emitBroadcast,
  emitPaymentResult,
  emitTicketReply,
  emitSessionUpdate,
  emitSystemStatus,
  // Exported for unit testing (see __tests__/socket.roles.test.js) — these
  // were previously private and only reachable by simulating a full socket
  // connection, which is exactly why the substring-matching bug in the old
  // isAdminRole() went unnoticed for as long as it did.
  isAdminRole,
  isSuperAdminRole,
};
