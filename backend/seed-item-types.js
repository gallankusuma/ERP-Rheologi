const Database = require('better-sqlite3');
const db = new Database('erp.db');

const itemTypes = [
  { code: 'INV', name: 'Inventory', description: 'Trackable inventory items', track_inventory: 1 },
  { code: 'NON-INV', name: 'Non-Inventory', description: 'Non-trackable items', track_inventory: 0 },
  { code: 'RAW', name: 'Raw Material', description: 'Raw materials for production', track_inventory: 1 },
  { code: 'PKG', name: 'Packaging', description: 'Packaging materials', track_inventory: 1 },
  { code: 'CHEM', name: 'Chemical', description: 'Chemical materials', track_inventory: 1 },
];

console.log('Seeding item types...');

const insertStmt = db.prepare(`
  INSERT OR IGNORE INTO item_types (code, name, description, track_inventory, is_active)
  VALUES (?, ?, ?, ?, 1)
`);

const insertMany = db.transaction((types) => {
  for (const type of types) {
    insertStmt.run(type.code, type.name, type.description, type.track_inventory);
  }
});

try {
  insertMany(itemTypes);
  console.log(`✅ Successfully seeded ${itemTypes.length} item types`);
  
  const result = db.prepare('SELECT * FROM item_types ORDER BY name').all();
  console.log(`\nTotal item types in database: ${result.length}`);
  console.log('\nItem types:');
  result.forEach(t => {
    console.log(`  - ${t.code}: ${t.name} (Track: ${t.track_inventory ? 'Yes' : 'No'})`);
  });
} catch (error) {
  console.error('❌ Error seeding item types:', error.message);
}

db.close();
