const mysql = require('mysql2/promise');

async function addSupplyColumn() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'erp_manufacturing',
  });

  try {
    const connection = await pool.getConnection();
    
    console.log('Checking if supply column exists...');
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_NAME = 'vendors' AND TABLE_SCHEMA = ? AND COLUMN_NAME = 'supply'`,
      [process.env.DB_NAME || 'erp_manufacturing']
    );

    if (columns.length === 0) {
      console.log('Adding supply column...');
      await connection.execute(
        'ALTER TABLE vendors ADD COLUMN supply VARCHAR(100) DEFAULT NULL'
      );
      console.log('✓ Added supply column');
    } else {
      console.log('✓ supply column already exists');
    }

    // Update vendors with supply categories
    console.log('\nUpdating vendors with supply categories...');
    
    const vendorUpdates = [
      ['V001', 'Chemical'],
      ['V002', 'Raw Material'],
      ['V003', 'Packaging'],
    ];

    for (const [code, supply] of vendorUpdates) {
      await connection.execute(
        'UPDATE vendors SET supply = ? WHERE code = ?',
        [supply, code]
      );
      console.log(`  ✓ Updated ${code} → Supply: ${supply}`);
    }

    // Show final vendors
    const [vendors] = await connection.execute(
      'SELECT id, code, name, supply FROM vendors'
    );

    console.log(`\n✅ Final vendors (${vendors.length} total):`);
    vendors.forEach(v => {
      console.log(`  - ${v.name} (${v.code}) | Supply: ${v.supply}`);
    });

    connection.release();
    pool.end();

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

addSupplyColumn();
