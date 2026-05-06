const Database = require('better-sqlite3');
const db = new Database('erp.db');

const categories = [
  { name: 'Raw Materials', description: 'Raw materials for production' },
  { name: 'Packaging', description: 'Packaging materials and supplies' },
  { name: 'Chemicals', description: 'Chemical materials and additives' },
  { name: 'Equipment', description: 'Equipment and machinery' },
  { name: 'Consumables', description: 'Consumable items' },
  { name: 'Other', description: 'Other items' },
];

console.log('Seeding categories...');

const insertStmt = db.prepare(`
  INSERT OR IGNORE INTO categories (name, description)
  VALUES (?, ?)
`);

const insertMany = db.transaction((cats) => {
  for (const cat of cats) {
    insertStmt.run(cat.name, cat.description);
  }
});

try {
  insertMany(categories);
  console.log(`✅ Successfully seeded ${categories.length} categories`);
  
  const result = db.prepare('SELECT * FROM categories ORDER BY name').all();
  console.log(`\nTotal categories in database: ${result.length}`);
  console.log('\nCategories:');
  result.forEach(c => {
    console.log(`  - ${c.name}`);
  });
} catch (error) {
  console.error('❌ Error seeding categories:', error.message);
}

db.close();
