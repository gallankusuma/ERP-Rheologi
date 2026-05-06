const Database = require('better-sqlite3');
const db = new Database('erp.db');

const sql = `
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

try {
  db.exec(sql);
  console.log('✅ Successfully created categories table');
  db.close();
} catch (error) {
  console.error('❌ Error creating table:', error.message);
  db.close();
  process.exit(1);
}
