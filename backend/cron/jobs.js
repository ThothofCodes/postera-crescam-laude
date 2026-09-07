// Copyright (c) 2026 Thoth of Codes. Unified cron job registry — all scheduled jobs
const cron = require('node-cron');
const { runBillingRenewals } = require('./billingRenewals');
const { runSLAMonitor } = require('./slaMonitor');
const { runAssessmentReset } = require('./assessmentReset');
const { runBISnapshot } = require('./biSnapshot');
const { runInventoryAlerts } = require('./inventoryAlerts');
const { runPSAutoClose } = require('./psAutoClose');
const { runScheduledPublish } = require('./scheduledPublish');
const { runMeetingStartNotify } = require('./meetingStartNotify');
const { runMeetingAutoActivate } = require('./meetingAutoActivate');
const { runSessionCleanup } = require('./sessionCleanup');

module.exports = function startCronJobs() {
  // Internet/cyber/webdev renewal invoices — 03:00 EAT daily
  cron.schedule('0 3 * * *', runBillingRenewals, { timezone: 'Africa/Nairobi' });
  // SLA breach detection — every 15 minutes
  cron.schedule('*/15 * * * *', runSLAMonitor, { timezone: 'Africa/Nairobi' });
  // Daily staff assessment records — midnight EAT
  cron.schedule('0 0 * * *', runAssessmentReset, { timezone: 'Africa/Nairobi' });
  // Nightly BI snapshot aggregation — 02:00 EAT
  cron.schedule('0 2 * * *', runBISnapshot, { timezone: 'Africa/Nairobi' });
  // Inventory low-stock and expiry alerts — 06:00 EAT
  cron.schedule('0 6 * * *', runInventoryAlerts, { timezone: 'Africa/Nairobi' });
  // PlayStation Arena — auto-close expired prepaid sessions, every minute
  cron.schedule('* * * * *', runPSAutoClose, { timezone: 'Africa/Nairobi' });
  // Tech Hub — auto-publish scheduled articles, every minute
  cron.schedule('* * * * *', runScheduledPublish, { timezone: 'Africa/Nairobi' });
  // Meeting start alerts — notify participants 5 min before scheduled start
  cron.schedule('* * * * *', runMeetingStartNotify, { timezone: 'Africa/Nairobi' });
  // Meeting auto-activate — transition SCHEDULED → ACTIVE when time arrives
  cron.schedule('* * * * *', runMeetingAutoActivate, { timezone: 'Africa/Nairobi' });
  // Session cleanup — remove expired and idle sessions every 15 minutes
  cron.schedule('*/15 * * * *', runSessionCleanup, { timezone: 'Africa/Nairobi' });

  console.log('✅ Cron jobs scheduled (EAT timezone):');
  console.log('   03:00 — Billing renewals');
  console.log('   */15m — SLA breach monitor');
  console.log('   00:00 — Daily assessment reset');
  console.log('   02:00 — BI snapshot');
  console.log('   06:00 — Inventory alerts');
  console.log('   */1m  — PS Arena auto-close');
  console.log('   */1m  — Scheduled article publish');
  console.log('   */1m  — Meeting start notifications');
  console.log('   */1m  — Meeting auto-activate');
  console.log('   */15m — Session cleanup');
};
