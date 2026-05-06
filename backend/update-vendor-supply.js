const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'erp.db');
const db = new Database(dbPath);

console.log('🔄 Updating vendor supply categories to match dropdowns...\n');

const updates = [
  { id: 1, supply: 'Chemical' },  // GLOBALINDO
  { id: 2, supply: 'Raw Material' },  // INDO CHEMICAL
  { id: 3, supply: 'Packaging' },  // ASIA PACKAGING
];

updates.forEach(u => {
  db.prepare('UPDATE vendors SET supply = ? WHERE id = ?').run(u.supply, u.id);
  console.log(`✅ Updated vendor #${u.id}: ${u.supply}`);
});

// Verify
console.log('\n📊 Vendors with updated supply categories:');
const vendors = db.prepare('SELECT id, code, name, supply FROM vendors').all();
vendors.forEach(v => console.log(`  #${v.id} | ${v.code} | ${v.name} | ${v.supply}`));

db.close();
console.log('\n✅ Done!');
