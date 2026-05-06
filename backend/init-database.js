// Initialize SQLite database with schema
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const schemaPath = path.join(__dirname, 'database', 'schema_sqlite.sql');

console.log('🚀 Initializing SQLite database...');
console.log('Database path:', dbPath);
console.log('Schema path:', schemaPath);

try {
  // Remove old database if exists
  if (fs.existsSync(dbPath)) {
    console.log('⚠️  Removing old database...');
    fs.unlinkSync(dbPath);
  }
  
  const db = new Database(dbPath);
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  
  console.log('📝 Executing schema...');
  db.exec(schema);
  
  console.log('✅ Database initialized successfully!');
  
  // Verify tables
  console.log('\n📊 Checking tables...');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  console.log(`Found ${tables.length} tables:`);
  tables.forEach(t => console.log(`  - ${t.name}`));
  
  // Check item types
  console.log('\n📦 Item Types:');
  const itemTypes = db.prepare("SELECT * FROM item_types").all();
  itemTypes.forEach(it => console.log(`  - ${it.code}: ${it.name} (Track: ${it.track_inventory ? 'Yes' : 'No'})`));
  
  // Check product types
  console.log('\n🏷️  Product Types:');
  const productTypes = db.prepare("SELECT * FROM product_types").all();
  productTypes.forEach(pt => console.log(`  - ${pt.code}: ${pt.name}`));
  
  // Check users
  console.log('\n👤 Users:');
  const users = db.prepare("SELECT email, name, role, user_level FROM users").all();
  users.forEach(u => console.log(`  - ${u.email} (${u.role}, Level ${u.user_level})`));
  
  db.close();
  console.log('\n✅ Database ready!');
  
} catch (error) {
  console.error('❌ Initialization failed:', error);
  process.exit(1);
}
