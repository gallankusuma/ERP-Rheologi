const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'erp.db');
const db = new Database(dbPath);

console.log('👥 Users in database:\n');
const users = db.prepare("SELECT id, email, name, user_level FROM users ORDER BY id").all();
users.forEach(u => console.log(`  ID: ${u.id} | ${u.email} | ${u.name} | Level ${u.user_level}`));

console.log('\n🔍 Checking for user ID 99999:');
const user99999 = db.prepare("SELECT * FROM users WHERE id = 99999").get();
if (user99999) {
  console.log('  ✅ Found:', user99999);
} else {
  console.log('  ❌ Not found - this is why FOREIGN KEY fails!');
}

db.close();
