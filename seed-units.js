const mysql = require('mysql2/promise');

async function seedUnits() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      database: 'erp_manufacturing'
    });

    const units = [
      { code: 'PCS', name: 'Pieces', description: 'Satuan buah/pcs', category: 'count' },
      { code: 'KG', name: 'Kilogram', description: 'Satuan berat kilogram', category: 'weight' },
      { code: 'LTR', name: 'Liter', description: 'Satuan volume liter', category: 'volume' },
      { code: 'MTR', name: 'Meter', description: 'Satuan panjang meter', category: 'length' },
      { code: 'UNIT', name: 'Unit', description: 'Satuan unit/set', category: 'count' },
      { code: 'BOX', name: 'Box', description: 'Satuan dus/kotak', category: 'packaging' }
    ];

    for (const unit of units) {
      const [result] = await connection.execute(
        'INSERT INTO uom (code, name, description, category, active) VALUES (?, ?, ?, ?, 1)',
        [unit.code, unit.name, unit.description, unit.category]
      );
      console.log(`Inserted: ${unit.code} - ${unit.name}`);
    }

    const [rows] = await connection.query('SELECT id, code, name FROM uom');
    console.log('\nAll units in database:');
    console.table(rows);

    await connection.end();
    console.log('\nSeeding completed successfully!');
  } catch (error) {
    console.error('Error seeding units:', error);
  }
}

seedUnits();
