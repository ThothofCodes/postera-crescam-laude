// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
// ── Session Cleanup Cron ────────────────────────────────────────────────
// Removes expired ActiveSession records from MongoDB.
// Runs every 15 minutes. Sessions that have passed their `expiresAt`
// or exceeded the idle timeout are deleted so the DB doesn't accumulate
// stale session documents.

const ActiveSession = require('../models/ActiveSession');

async function runSessionCleanup() {
  try {
    const now = new Date();
    const IDLE_TIMEOUT_MS = parseInt(process.env.SESSION_IDLE_TIMEOUT_MINUTES || '30', 10) * 60 * 1000;
    const idleCutoff = new Date(now.getTime() - IDLE_TIMEOUT_MS);

    // 1. Remove sessions that have passed their absolute expiry
    const expiredResult = await ActiveSession.deleteMany({
      expiresAt: { $lt: now },
    });

    // 2. Remove sessions that have been idle too long
    const idleResult = await ActiveSession.deleteMany({
      lastActivityAt: { $lt: idleCutoff },
    });

    const totalRemoved = expiredResult.deletedCount + idleResult.deletedCount;
    if (totalRemoved > 0) {
      console.log(`[SessionCleanup] Removed ${totalRemoved} stale sessions (expired: ${expiredResult.deletedCount}, idle: ${idleResult.deletedCount})`);
    }
  } catch (err) {
    console.error('[SessionCleanup] Error:', err.message);
  }
}

module.exports = { runSessionCleanup };
