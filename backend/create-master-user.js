const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');

const dbPath = path.join(__dirname, 'erp.db');
const db = new Database(dbPath);

console.log('👤 Creating Master Admin user (ID: 99999)...\n');

const hashedPassword = bcrypt.hashSync('master', 10);

try {
  // Check if exists first
  const existing = db.prepare("SELECT id FROM users WHERE id = 99999").get();
  if (existing) {
    console.log('⏭️  User 99999 already exists, updating...');
    db.prepare(`
      UPDATE users 
      SET email = ?, password = ?, name = ?, user_level = ?, is_active = 1
      WHERE id = 99999
    `).run('master@admin.com', hashedPassword, 'Master Admin', 10);
  } else {
    console.log('➕ Inserting new user 99999...');
    db.prepare(`
      INSERT INTO users (id, email, password, name, user_level, is_active, created_at, updated_at)
      VALUES (99999, ?, ?, ?, 10, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run('master@admin.com', hashedPassword, 'Master Admin');
  }
  
  console.log('✅ Master Admin created/updated successfully!');
  console.log('   Email: master@admin.com');
  console.log('   Password: master');
  console.log('   Level: 10');
  
} catch (error) {
  console.error('❌ Error:', error.message);
}

db.close();
