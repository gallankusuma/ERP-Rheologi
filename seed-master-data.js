const mysql = require('mysql2/promise');

async function seedMasterData() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      database: 'erp_manufacturing'
    });

    // Seed Categories
    const categories = [
      { name: 'Raw Material', description: 'Bahan baku produksi' },
      { name: 'Finished Goods', description: 'Produk jadi siap jual' },
      { name: 'Work In Progress', description: 'Barang setengah jadi' },
      { name: 'Consumables', description: 'Bahan habis pakai' },
      { name: 'Spare Parts', description: 'Suku cadang' }
    ];

    console.log('Seeding categories...');
    for (const cat of categories) {
      const [result] = await connection.execute(
        'INSERT INTO categories (name, description, active) VALUES (?, ?, 1)',
        [cat.name, cat.description]
      );
      console.log(`✓ ${cat.name}`);
    }

    // Seed Product Types
    const productTypes = [
      { code: 'INV', name: 'Inventory', description: 'Item yang ditrack di inventory' },
      { code: 'NON-INV', name: 'Non-Inventory', description: 'Item non-inventory (expense)' },
      { code: 'SVC', name: 'Service', description: 'Layanan/jasa' },
      { code: 'KIT', name: 'Kit', description: 'Paket/kit produk' }
    ];

    console.log('\nSeeding product types...');
    for (const pt of productTypes) {
      const [result] = await connection.execute(
        'INSERT INTO product_types (code, name, description, active) VALUES (?, ?, ?, 1)',
        [pt.code, pt.name, pt.description]
      );
      console.log(`✓ ${pt.name}`);
    }

    console.log('\n✅ Master data seeding completed!\n');
    
    // Show summary
    const [categories_] = await connection.query('SELECT id, name FROM categories');
    const [types_] = await connection.query('SELECT id, code, name FROM product_types');
    const [units_] = await connection.query('SELECT id, code, name FROM uom');

    console.log(`\nDatabase Summary:`);
    console.log(`- Categories: ${categories_.length}`);
    console.log(`- Product Types: ${types_.length}`);
    console.log(`- Units of Measure: ${units_.length}`);

    await connection.end();
  } catch (error) {
    console.error('❌ Error seeding data:', error.message);
  }
}

seedMasterData();
