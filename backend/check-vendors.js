const mysql = require('mysql2/promise');

async function checkVendors() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'erp_manufacturing',
  });

  try {
    const connection = await pool.getConnection();
    
    // Check if vendors table exists
    const [tables] = await connection.execute(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'vendors'`,
      [process.env.DB_NAME || 'erp_manufacturing']
    );

    if (tables.length === 0) {
      console.log('❌ vendors table does NOT exist');
      connection.release();
      pool.end();
      return;
    }

    console.log('✓ vendors table exists\n');

    // Get vendors
    const [vendors] = await connection.execute(
      'SELECT id, code, name, contact, phone, email, supply FROM vendors LIMIT 10'
    );

    console.log(`Found ${vendors.length} vendors:\n`);
    
    if (vendors.length === 0) {
      console.log('⚠️ No vendors in database. Need to seed vendor data.\n');
      
      // Try to insert some test vendors
      console.log('Inserting test vendors...');
      const testVendors = [
        ['V001', 'PT Chemical Supply', 'Budi Santoso', '081234567890', 'chemical@supplier.com', 'Chemical'],
        ['V002', 'Raw Material Corp', 'Siti Nurhaliza', '081234567891', 'raw@material.com', 'Raw Material'],
        ['V003', 'Packaging Solutions', 'Ahmad Wijaya', '081234567892', 'pack@solutions.com', 'Packaging'],
      ];

      for (const vendor of testVendors) {
        try {
          await connection.execute(
            'INSERT INTO vendors (code, name, contact, phone, email, supply) VALUES (?, ?, ?, ?, ?, ?)',
            vendor
          );
          console.log(`  ✓ Created vendor: ${vendor[1]}`);
        } catch (err) {
          console.error(`  ✗ Failed to create vendor: ${vendor[1]}`, err.message.substring(0, 100));
        }
      }

      // Fetch newly inserted vendors
      const [newVendors] = await connection.execute(
        'SELECT id, code, name, contact, phone, email, supply FROM vendors'
      );
      
      console.log(`\n✅ Now have ${newVendors.length} vendors:\n`);
      newVendors.forEach(v => {
        console.log(`  - ${v.name} (${v.code}) - Supply: ${v.supply}`);
      });
    } else {
      vendors.forEach(v => {
        console.log(`  - ID:${v.id} | ${v.name} (${v.code}) | Supply: ${v.supply} | Phone: ${v.phone}`);
      });
    }

    connection.release();
    pool.end();

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkVendors();
