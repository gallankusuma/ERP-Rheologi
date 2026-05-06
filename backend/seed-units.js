const Database = require('better-sqlite3');
const db = new Database('erp.db');

const units = [
  { code: 'KG', name: 'Kilogram', abbreviation: 'kg', description: 'Unit of mass - kilogram' },
  { code: 'G', name: 'Gram', abbreviation: 'g', description: 'Unit of mass - gram' },
  { code: 'L', name: 'Liter', abbreviation: 'L', description: 'Unit of volume - liter' },
  { code: 'ML', name: 'Milliliter', abbreviation: 'mL', description: 'Unit of volume - milliliter' },
  { code: 'PCS', name: 'Pieces', abbreviation: 'pcs', description: 'Count unit - pieces' },
  { code: 'BOX', name: 'Box', abbreviation: 'box', description: 'Packaging unit - box' },
  { code: 'DRUM', name: 'Drum', abbreviation: 'drum', description: 'Packaging unit - drum' },
  { code: 'BAG', name: 'Bag', abbreviation: 'bag', description: 'Packaging unit - bag' },
  { code: 'SACK', name: 'Sack', abbreviation: 'sack', description: 'Packaging unit - sack' },
  { code: 'BOTTLE', name: 'Bottle', abbreviation: 'btl', description: 'Packaging unit - bottle' },
  { code: 'PACK', name: 'Pack', abbreviation: 'pack', description: 'Packaging unit - pack' },
  { code: 'ROLL', name: 'Roll', abbreviation: 'roll', description: 'Packaging unit - roll' },
  { code: 'METER', name: 'Meter', abbreviation: 'm', description: 'Unit of length - meter' },
  { code: 'CM', name: 'Centimeter', abbreviation: 'cm', description: 'Unit of length - centimeter' },
  { code: 'SHEET', name: 'Sheet', abbreviation: 'sheet', description: 'Count unit - sheet' },
  { code: 'SET', name: 'Set', abbreviation: 'set', description: 'Count unit - set' },
  { code: 'CARTON', name: 'Carton', abbreviation: 'ctn', description: 'Packaging unit - carton' },
  { code: 'GALLON', name: 'Gallon', abbreviation: 'gal', description: 'Unit of volume - gallon' },
  { code: 'DOZEN', name: 'Dozen', abbreviation: 'dz', description: 'Count unit - dozen (12 pieces)' },
  { code: 'UNIT', name: 'Unit', abbreviation: 'unit', description: 'Generic count unit' },
];

console.log('Seeding units of measure...');

const insertStmt = db.prepare(`
  INSERT INTO units_of_measure (code, name, abbreviation, description, is_active)
  VALUES (?, ?, ?, ?, 1)
`);

const insertMany = db.transaction((units) => {
  for (const unit of units) {
    insertStmt.run(unit.code, unit.name, unit.abbreviation, unit.description);
  }
});

try {
  insertMany(units);
  console.log(`✅ Successfully seeded ${units.length} units of measure`);
  
  const result = db.prepare('SELECT * FROM units_of_measure ORDER BY name').all();
  console.log(`\nTotal units in database: ${result.length}`);
  console.log('\nSample units:');
  result.slice(0, 5).forEach(u => {
    console.log(`  - ${u.code}: ${u.name} (${u.abbreviation})`);
  });
} catch (error) {
  console.error('❌ Error seeding units:', error.message);
}

db.close();
