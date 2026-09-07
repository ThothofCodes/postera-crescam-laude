// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
const router = require('express').Router();
const { z } = require('zod');
const ctrl = require('../controllers/ticketController');
const { notifyCustomer } = require('../config/africastalking');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const {
  protect, staffGuard, deptHeadGuard, superAdminGuard,
} = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  createTicketSchema, updateTicketStatusSchema, addTicketReplySchema, mongoId,
} = require('../validations/schemas');

router.use(protect, staffGuard);

router.get('/', ctrl.getTickets);
router.post('/', validate(createTicketSchema), ctrl.createTicket);
router.get('/my', ctrl.getMyTickets);
router.get('/escalated', superAdminGuard, ctrl.getEscalated);
router.get('/:id', validate(z.object({ id: mongoId }), 'params'), ctrl.getTicket);
router.patch('/:id/assign', deptHeadGuard, validate(z.object({ id: mongoId }), 'params'), ctrl.assignTicket);
router.post('/:id/reply', validate(z.object({ id: mongoId }), 'params'), validate(addTicketReplySchema), ctrl.replyTicket);
router.patch('/:id/status', staffGuard, validate(z.object({ id: mongoId }), 'params'), validate(updateTicketStatusSchema), ctrl.updateStatus);
router.post('/:id/escalate', staffGuard, validate(z.object({ id: mongoId }), 'params'), ctrl.escalateTicket);
router.patch('/:id/resolve', deptHeadGuard, validate(z.object({ id: mongoId }), 'params'), ctrl.updateStatus);
router.post('/:id/rate', validate(z.object({ id: mongoId }), 'params'), ctrl.rateTicket);

router.post('/:id/notify', validate(z.object({ id: mongoId }), 'params'), async (req, res) => {
  try {
    const { message, channel } = req.body;
    if (!message) return res.status(400).json({ message: 'Message required' });
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    let phone = null;
    let customerName = 'Customer';
    if (ticket.raisedBy) {
      const user = await User.findById(ticket.raisedBy).select('phone email name');
      phone = user?.email || user?.phone;
      customerName = user?.name || 'Customer';
    }
    if (!phone && ticket.thread?.length) {
      const contactEntry = ticket.thread.find((t) => t.authorRole === 'CLIENT');
      if (contactEntry?.message) {
        const [, phoneMatch] = contactEntry.message.match(/\+?\d{10,15}/);
        if (phoneMatch) phone = phoneMatch;
      }
    }
    if (!phone) return res.status(404).json({ message: 'Customer contact not found' });
    await notifyCustomer(phone, message, channel || 'sms');
    res.json({ success: true, message: `${(channel || 'sms').toUpperCase()} notification sent to ${customerName} (${phone})` });
  } catch (err) {
    console.error('Ticket notify error:', err.message);
    res.status(500).json({ message: 'Failed to send notification' });
  }
});

module.exports = router;
