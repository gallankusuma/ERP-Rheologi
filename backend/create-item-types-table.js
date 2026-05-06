const Database = require('better-sqlite3');
const db = new Database('erp.db');

const sql = `
CREATE TABLE IF NOT EXISTS item_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  track_inventory INTEGER DEFAULT 1,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

try {
  db.exec(sql);
  console.log('✅ Successfully created item_types table');
  
  // Check if table exists
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='item_types'").all();
  if (tables.length > 0) {
    console.log('✅ Table item_types confirmed to exist');
  }
  
  db.close();
} catch (error) {
  console.error('❌ Error creating table:', error.message);
  db.close();
  process.exit(1);
}
