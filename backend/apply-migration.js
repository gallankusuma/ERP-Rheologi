const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Get database path - matches the path in database.ts
const dbPath = path.join(__dirname, '..', 'erp.db');

// Connect to database
const db = new Database(dbPath);

try {
  console.log('🔄 Applying missing tables migration...');

  // Read and execute migration SQL
  const migrationSql = fs.readFileSync(
    path.join(__dirname, './database/add_missing_tables.sql'),
    'utf8'
  );

  // Execute each statement
  const statements = migrationSql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    try {
      db.exec(statement);
    } catch (error) {
      // Ignore IF NOT EXISTS errors
      if (!error.message.includes('already exists')) {
        console.error('Error executing statement:', statement);
        console.error(error.message);
      }
    }
  }

  console.log('✅ Migration completed successfully');

  // Verify new tables exist
  const tables = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name IN 
      ('employees', 'attendance_logs', 'cogs_tracking', 'profitability_tracking', 
       'accounts_payable', 'accounts_receivable', 'financial_summary', 'notifications', 'system_settings')`
    )
    .all();

  console.log(`\n✅ Created/verified ${tables.length} new tables:`);
  tables.forEach((t) => console.log(`   - ${t.name}`));

  process.exit(0);
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
} finally {
  db.close();
}
