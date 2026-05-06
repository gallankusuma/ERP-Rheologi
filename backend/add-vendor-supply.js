const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'erp.db');
const db = new Database(dbPath);

console.log('🔧 Adding supply column to vendors table...\n');

try {
  db.exec('ALTER TABLE vendors ADD COLUMN supply TEXT DEFAULT "General"');
  console.log('✅ Column "supply" added to vendors table');
} catch (error) {
  if (error.message.includes('duplicate column')) {
    console.log('⏭️  Column "supply" already exists');
  } else {
    console.error('❌ Error:', error.message);
  }
}

// Update existing vendors with supply category
const updates = [
  { id: 1, supply: 'Chemical, Packaging' },  // GLOBALINDO
  { id: 2, supply: 'Chemical, Raw Material' },  // INDO CHEMICAL
  { id: 3, supply: 'Packaging' },  // ASIA PACKAGING
];

updates.forEach(u => {
  db.prepare('UPDATE vendors SET supply = ? WHERE id = ?').run(u.supply, u.id);
  console.log(`✅ Updated vendor #${u.id} supply: ${u.supply}`);
});

// Verify
console.log('\n📊 Vendors with supply:');
const vendors = db.prepare('SELECT id, code, name, supply FROM vendors').all();
vendors.forEach(v => console.log(`  #${v.id} | ${v.code} | ${v.name} | Supply: ${v.supply}`));

db.close();
console.log('\n✅ Done!');
