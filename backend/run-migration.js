// Migration script to add missing tables and columns
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Use the same DB file as the app (see backend/src/config/database.ts)
const dbPath = path.join(__dirname, 'erp.db');
const migrationPath = path.join(__dirname, 'database', 'migrations_fix.sql');

console.log('🔧 Running database migration...');
console.log('Database path:', dbPath);

try {
  const db = new Database(dbPath);
  const migration = fs.readFileSync(migrationPath, 'utf-8');
  
  // Split by semicolon and execute each statement
  const statements = migration
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  let executed = 0;
  let skipped = 0;
  
  for (const statement of statements) {
    try {
      db.exec(statement);
      executed++;
      console.log(`✅ Executed: ${statement.substring(0, 60)}...`);
    } catch (error) {
      // Skip errors for ALTER TABLE if column already exists
      if (error.message.includes('duplicate column name')) {
        skipped++;
        console.log(`⏭️  Skipped (already exists): ${statement.substring(0, 60)}...`);
      } else {
        console.error(`❌ Error: ${error.message}`);
        console.error(`Statement: ${statement}`);
      }
    }
  }
  
  db.close();
  console.log(`\n✅ Migration complete! Executed: ${executed}, Skipped: ${skipped}`);
  console.log('📊 Checking tables...');
  
  // Verify tables exist
  const dbCheck = new Database(dbPath);
  const tables = dbCheck.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('Tables:', tables.map(t => t.name).join(', '));
  
  // Check if item_types has data (skip if table doesn't exist)
  try {
    const itemTypes = dbCheck.prepare("SELECT * FROM item_types").all();
    console.log(`\nItem Types: ${itemTypes.length} records`);
    itemTypes.forEach(it => console.log(`  - ${it.code}: ${it.name}`));
  } catch (e) {
    console.log('\nItem Types: table not found (skipped)');
  }
  
  // Check users with user_level
  const users = dbCheck.prepare("SELECT id, email, user_level FROM users").all();
  console.log(`\nUsers: ${users.length} records`);
  users.forEach(u => console.log(`  - ${u.email} (Level ${u.user_level || 'NULL'})`));
  
  dbCheck.close();
  
} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
}
