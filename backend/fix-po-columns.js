const mysql = require('mysql2/promise');

async function checkPOSchema() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'erp_manufacturing',
  });

  try {
    const connection = await pool.getConnection();
    
    console.log('Checking purchase_orders table columns...\n');
    
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_NAME = 'purchase_orders' AND TABLE_SCHEMA = ?
       ORDER BY ORDINAL_POSITION`,
      [process.env.DB_NAME || 'erp_manufacturing']
    );

    console.log('Current columns:');
    const colNames = [];
    columns.forEach(col => {
      console.log(`  ${col.COLUMN_NAME}`);
      colNames.push(col.COLUMN_NAME);
    });

    // Check if expected_date exists
    if (!colNames.includes('expected_date')) {
      console.log('\n✓ Adding expected_date column...');
      await connection.execute('ALTER TABLE purchase_orders ADD COLUMN expected_date DATE NULL AFTER status');
      console.log('✓ Added expected_date');
    } else {
      console.log('\n✓ expected_date already exists');
    }

    // Check if other commonly used columns exist
    const neededColumns = ['po_date', 'payment_term', 'type', 'contact_person', 'delivery_to', 'address', 'advance_payment', 'discount_percent', 'ppn_percent'];
    
    console.log('\nChecking other columns...');
    for (const col of neededColumns) {
      if (!colNames.includes(col)) {
        console.log(`  ⚠️ Missing: ${col}`);
      } else {
        console.log(`  ✓ ${col}`);
      }
    }

    // Add missing columns
    if (!colNames.includes('po_date')) {
      await connection.execute('ALTER TABLE purchase_orders ADD COLUMN po_date DATE NULL');
      console.log('✓ Added po_date');
    }
    if (!colNames.includes('payment_term')) {
      await connection.execute('ALTER TABLE purchase_orders ADD COLUMN payment_term VARCHAR(100) NULL');
      console.log('✓ Added payment_term');
    }
    if (!colNames.includes('type')) {
      await connection.execute('ALTER TABLE purchase_orders ADD COLUMN type VARCHAR(50) NULL');
      console.log('✓ Added type');
    }
    if (!colNames.includes('contact_person')) {
      await connection.execute('ALTER TABLE purchase_orders ADD COLUMN contact_person VARCHAR(100) NULL');
      console.log('✓ Added contact_person');
    }
    if (!colNames.includes('delivery_to')) {
      await connection.execute('ALTER TABLE purchase_orders ADD COLUMN delivery_to VARCHAR(255) NULL');
      console.log('✓ Added delivery_to');
    }
    if (!colNames.includes('address')) {
      await connection.execute('ALTER TABLE purchase_orders ADD COLUMN address TEXT NULL');
      console.log('✓ Added address');
    }
    if (!colNames.includes('advance_payment')) {
      await connection.execute('ALTER TABLE purchase_orders ADD COLUMN advance_payment DECIMAL(15,2) DEFAULT 0');
      console.log('✓ Added advance_payment');
    }
    if (!colNames.includes('discount_percent')) {
      await connection.execute('ALTER TABLE purchase_orders ADD COLUMN discount_percent DECIMAL(5,2) DEFAULT 0');
      console.log('✓ Added discount_percent');
    }
    if (!colNames.includes('ppn_percent')) {
      await connection.execute('ALTER TABLE purchase_orders ADD COLUMN ppn_percent DECIMAL(5,2) DEFAULT 0');
      console.log('✓ Added ppn_percent');
    }

    console.log('\n✅ Schema update complete!');

    connection.release();
    pool.end();

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkPOSchema();
