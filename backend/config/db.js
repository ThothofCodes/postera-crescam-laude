// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
const mongoose = require('mongoose');
const ConnectionPoolManager = require('../utils/connectionPool');

const connectDB = async () => {
  const uri = process.env.MONGO_URI;

  if (!uri || uri.includes('<user>') || uri.includes('<password>')) {
    console.error('\n╔══════════════════════════════════════════════════════╗');
    console.error('║  ❌  MONGO_URI is not configured in backend/.env     ║');
    console.error('║                                                      ║');
    console.error('║  1. Open backend/.env                                ║');
    console.error('║  2. Replace the MONGO_URI placeholder with your      ║');
    console.error('║     MongoDB Atlas connection string                  ║');
    console.error('║  3. Restart the server: npm run dev                  ║');
    console.error('╚══════════════════════════════════════════════════════╝\n');
    // Don't crash — server still starts so health endpoint works
    return;
  }

  try {
    const isProduction = process.env.NODE_ENV === 'production';

    mongoose.set('bufferCommands', false); // fail fast instead of buffering

    // Use optimized connection pooling
    await ConnectionPoolManager.connect({
      mongoUri: uri,
      isProduction,
    });

    // Warm up connection pool
    await ConnectionPoolManager.warmUpPool();

    console.log(`✅  MongoDB connected with optimized pooling: ${mongoose.connection.host}`);
  } catch (err) {
    console.error(`❌  MongoDB connection failed: ${err.message}`);
    console.error('    Starting in degraded mode — health endpoint will report degraded status.\n');
    // Don't throw — server starts in degraded mode and health endpoint reports state
    // Auto-retry connection after 10 seconds
    setTimeout(() => {
      console.log('🔄  Retrying MongoDB connection...');
      connectDB().catch(() => {});
    }, 10000);
  }
};

module.exports = connectDB;
