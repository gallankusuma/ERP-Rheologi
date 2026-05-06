const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'erp.db');
const db = new Database(dbPath);

console.log('🔧 Adding missing columns to purchase_requests...');

const missingColumns = [
  'approval_status INTEGER DEFAULT 0',
  'approved_by_supervisor_id INTEGER',
  'approved_by_manager_id INTEGER',
  'approved_at_supervisor DATETIME',
  'approved_at_manager DATETIME'
];

missingColumns.forEach(col => {
  const colName = col.split(' ')[0];
  try {
    db.exec(`ALTER TABLE purchase_requests ADD COLUMN ${col}`);
    console.log(`✅ Added: ${colName}`);
  } catch (error) {
    if (error.message.includes('duplicate column')) {
      console.log(`⏭️  Skipped: ${colName} (already exists)`);
    } else {
      console.error(`❌ Error adding ${colName}:`, error.message);
    }
  }
});

// Verify
const columns = db.prepare("PRAGMA table_info(purchase_requests)").all();
console.log('\n📋 Current columns:');
columns.forEach(col => console.log(`  - ${col.name} (${col.type})`));

db.close();
