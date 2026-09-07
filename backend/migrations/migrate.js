/**
 * Database Migration Runner
 *
 * Usage:
 *   node migrations/migrate.js up          # Run all pending migrations
 *   node migrations/migrate.js down        # Rollback last migration
 *   node migrations/migrate.js status      # Show migration status
 *   node migrations/migrate.js create <name>  # Create new migration file
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Migration schema for tracking
const MigrationSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  batch: { type: Number, required: true },
  executedAt: { type: Date, default: Date.now },
  duration: Number, // milliseconds
  status: { type: String, enum: ['success', 'failed', 'pending'], default: 'pending' },
  error: String,
}, { timestamps: true });

const Migration = mongoose.model('Migration', MigrationSchema);

// Get all migration files sorted by name
function getMigrationFiles() {
  const migrationsDir = path.join(__dirname);
  return fs.readdirSync(migrationsDir)
    .filter((f) => f.match(/^\d{4}_\d{2}_\d{2}_\d{6}_.*\.js$/))
    .sort()
    .map((f) => ({
      name: f.replace('.js', ''),
      path: path.join(migrationsDir, f),
    }));
}

// Run all pending migrations
async function runMigrations() {
  console.log('\n🔄  Running database migrations...\n');

  const migrationFiles = getMigrationFiles();
  const executed = await Migration.find({ status: 'success' }).select('name');
  const executedNames = new Set(executed.map((m) => m.name));

  const pending = migrationFiles.filter((m) => !executedNames.has(m.name));

  if (pending.length === 0) {
    console.log('✅  No pending migrations.\n');
    return;
  }

  console.log(`📋  ${pending.length} pending migration(s):\n`);
  pending.forEach((m) => console.log(`   - ${m.name}`));
  console.log('');

  // Get current batch number
  const lastMigration = await Migration.findOne().sort({ batch: -1 });
  const batch = (lastMigration?.batch || 0) + 1;

  let successCount = 0;
  let failCount = 0;

  for (const migration of pending) {
    const startTime = Date.now();

    try {
      console.log(`⏳  Running: ${migration.name}`);
      // eslint-disable-next-line import/no-dynamic-require
      const migrationModule = require(migration.path);
      await migrationModule.up(mongoose.connection.db);

      const duration = Date.now() - startTime;

      await Migration.create({
        name: migration.name,
        batch,
        duration,
        status: 'success',
      });

      console.log(`✅  Completed: ${migration.name} (${duration}ms)\n`);
      successCount++;
    } catch (error) {
      const duration = Date.now() - startTime;

      await Migration.create({
        name: migration.name,
        batch,
        duration,
        status: 'failed',
        error: error.message,
      });

      console.error(`❌  Failed: ${migration.name}`);
      console.error(`   Error: ${error.message}\n`);
      failCount++;

      // Stop on first failure
      break;
    }
  }

  console.log('══════════════════════════════════════════════════');
  console.log(`  Migrations complete: ${successCount} succeeded, ${failCount} failed`);
  console.log('══════════════════════════════════════════════════\n');
}

// Rollback last batch
async function rollbackMigrations() {
  console.log('\n⏪  Rolling back migrations...\n');

  const lastBatch = await Migration.findOne().sort({ batch: -1 });
  if (!lastBatch) {
    console.log('ℹ️   No migrations to rollback.\n');
    return;
  }

  const toRollback = await Migration.find({ batch: lastBatch.batch, status: 'success' })
    .sort({ name: -1 }); // Reverse order

  console.log(`📋  Rolling back batch ${lastBatch.batch} (${toRollback.length} migration(s)):\n`);
  toRollback.forEach((m) => console.log(`   - ${m.name}`));
  console.log('');

  let successCount = 0;
  let failCount = 0;

  for (const migration of toRollback) {
    try {
      const migrationFile = path.join(__dirname, `${migration.name}.js`);
      // eslint-disable-next-line import/no-dynamic-require
      const migrationModule = require(migrationFile);

      if (!migrationModule.down) {
        console.log(`⚠️   Skipping ${migration.name} (no down method)\n`);
        continue;
      }

      console.log(`⏳  Rolling back: ${migration.name}`);
      await migrationModule.down(mongoose.connection.db);

      await Migration.deleteOne({ _id: migration._id });

      console.log(`✅  Rolled back: ${migration.name}\n`);
      successCount++;
    } catch (error) {
      console.error(`❌  Failed to rollback: ${migration.name}`);
      console.error(`   Error: ${error.message}\n`);
      failCount++;
    }
  }

  console.log('══════════════════════════════════════════════════');
  console.log(`  Rollback complete: ${successCount} succeeded, ${failCount} failed`);
  console.log('══════════════════════════════════════════════════\n');
}

// Show migration status
async function showStatus() {
  console.log('\n📊  Migration Status\n');

  const migrationFiles = getMigrationFiles();
  const executed = await Migration.find().sort({ batch: 1, name: 1 });
  const executedMap = new Map(executed.map((m) => [m.name, m]));

  console.log('  Migration                              Status      Batch  Duration');
  console.log('  ─────────────────────────────────────────────────────────────────────');

  for (const file of migrationFiles) {
    const record = executedMap.get(file.name);
    if (record) {
      const status = record.status === 'success' ? '✅ success' : '❌ failed';
      const batch = `#${record.batch}`;
      const duration = record.duration ? `${record.duration}ms` : '-';
      console.log(`  ${file.name.padEnd(38)} ${status.padEnd(12)} ${batch.padEnd(7)} ${duration}`);
    } else {
      console.log(`  ${file.name.padEnd(38)} ⏳ pending`);
    }
  }

  console.log('');
}

// Create new migration file
function createMigration(name) {
  const date = new Date();
  const timestamp = date.toISOString()
    .replace(/[-:T]/g, '')
    .slice(0, 14);

  const filename = `${timestamp}_${name.replace(/\s+/g, '_').toLowerCase()}.js`;
  const filepath = path.join(__dirname, filename);

  const template = `/**
 * Migration: ${name}
 * Created: ${date.toISOString()}
 */

module.exports = {
  async up(db) {
    // TODO: Implement migration
    // Example: await db.collection('users').updateMany({}, { $set: { newField: 'default' } });
    console.log('   Migration up: ${name}');
  },

  async down(db) {
    // TODO: Implement rollback
    // Example: await db.collection('users').updateMany({}, { $unset: { newField: '' } });
    console.log('   Migration down: ${name}');
  },
};
`;

  fs.writeFileSync(filepath, template);
  console.log(`\n✅  Created migration: ${filename}\n`);
}

// Main
async function main() {
  if (!process.env.MONGO_URI || process.env.MONGO_URI.includes('<')) {
    console.error('\n❌  MONGO_URI not set in .env\n');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('🔌  Connected to MongoDB.\n');

  const command = process.argv[2];

  try {
    switch (command) {
      case 'up':
        await runMigrations();
        break;
      case 'down':
        await rollbackMigrations();
        break;
      case 'status':
        await showStatus();
        break;
      case 'create': {
        const name = process.argv[3];
        if (!name) {
          console.error('\n❌  Usage: node migrate.js create <migration_name>\n');
          process.exit(1);
        }
        createMigration(name);
        break;
      }
      default:
        console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                    Database Migration Runner                      ║
╚══════════════════════════════════════════════════════════════════╝

Usage: node migrations/migrate.js <command>

Commands:
  up              Run all pending migrations
  down            Rollback last batch of migrations
  status          Show migration status
  create <name>   Create a new migration file

Examples:
  node migrations/migrate.js up
  node migrations/migrate.js down
  node migrations/migrate.js status
  node migrations/migrate.js create add-user-index

`);
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error('\n❌  Migration error:', err.message);
  process.exit(1);
});
