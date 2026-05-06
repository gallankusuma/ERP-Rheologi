const mysql = require('mysql2/promise');

async function checkVendorsSchema() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'erp_manufacturing',
  });

  try {
    const connection = await pool.getConnection();
    
    // Get vendors table structure
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_NAME = 'vendors' AND TABLE_SCHEMA = ?
       ORDER BY ORDINAL_POSITION`,
      [process.env.DB_NAME || 'erp_manufacturing']
    );

    console.log('Vendors table structure:');
    columns.forEach(col => {
      console.log(`  ${col.COLUMN_NAME} (${col.COLUMN_TYPE}) - Nullable: ${col.IS_NULLABLE}`);
    });

    // Check how many vendors exist
    const [vendors] = await connection.execute('SELECT COUNT(*) as count FROM vendors');
    console.log(`\nVendors count: ${vendors[0].count}`);

    if (vendors[0].count === 0) {
      console.log('\n⚠️ No vendors. Inserting test data...');
      
      // Insert test vendors based on actual schema
      const testVendors = [
        ['PT Chemical Supply', 'V001'],
        ['Raw Material Corp', 'V002'],
        ['Packaging Solutions', 'V003'],
      ];

      for (const [name, code] of testVendors) {
        try {
          await connection.execute(
            'INSERT INTO vendors (name, code) VALUES (?, ?)',
            [name, code]
          );
          console.log(`  ✓ Created: ${name}`);
        } catch (err) {
          if (err.message.includes('Duplicate')) {
            console.log(`  ~ Already exists: ${name}`);
          } else {
            console.error(`  ✗ Error: ${err.message.substring(0, 100)}`);
          }
        }
      }
    }

    // Show all vendors
    const [allVendors] = await connection.execute(
      'SELECT id, code, name FROM vendors'
    );

    console.log(`\n✅ Final vendor list (${allVendors.length} total):`);
    allVendors.forEach(v => {
      console.log(`  - ${v.name} (${v.code})`);
    });

    connection.release();
    pool.end();

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkVendorsSchema();
