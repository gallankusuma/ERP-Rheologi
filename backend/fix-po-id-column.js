const mysql = require('mysql2/promise');

async function fixPOIdColumn() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'erp_manufacturing',
  });

  try {
    const connection = await pool.getConnection();
    
    console.log('Checking purchase_order_items columns...\n');
    
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_NAME = 'purchase_order_items' AND TABLE_SCHEMA = ?
       ORDER BY ORDINAL_POSITION`,
      [process.env.DB_NAME || 'erp_manufacturing']
    );

    console.log('Current columns:');
    const colNames = [];
    columns.forEach(col => {
      console.log(`  ${col.COLUMN_NAME}`);
      colNames.push(col.COLUMN_NAME);
    });

    const hasPurchaseOrderId = colNames.includes('purchase_order_id');
    const hasPoId = colNames.includes('po_id');

    console.log(`\nhas purchase_order_id: ${hasPurchaseOrderId}`);
    console.log(`has po_id: ${hasPoId}`);

    if (hasPurchaseOrderId && hasPoId) {
      console.log('\nBoth columns exist! Dropping po_id and keeping purchase_order_id...');
      await connection.execute('ALTER TABLE purchase_order_items DROP COLUMN po_id');
      console.log('✓ Dropped po_id');
      
      // Now rename purchase_order_id to po_id
      await connection.execute('ALTER TABLE purchase_order_items CHANGE COLUMN purchase_order_id po_id INT NOT NULL');
      console.log('✓ Renamed purchase_order_id → po_id');
    } else if (hasPurchaseOrderId) {
      console.log('\nRenaming purchase_order_id → po_id...');
      await connection.execute('ALTER TABLE purchase_order_items CHANGE COLUMN purchase_order_id po_id INT NOT NULL');
      console.log('✓ Renamed');
    } else if (hasPoId) {
      console.log('\n✓ Already using po_id');
    }

    // Show final structure
    const [finalCols] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_NAME = 'purchase_order_items' AND TABLE_SCHEMA = ?
       ORDER BY ORDINAL_POSITION`,
      [process.env.DB_NAME || 'erp_manufacturing']
    );

    console.log('\n✅ Final columns:');
    finalCols.forEach(col => {
      console.log(`  ${col.COLUMN_NAME}`);
    });

    connection.release();
    pool.end();

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

fixPOIdColumn();
