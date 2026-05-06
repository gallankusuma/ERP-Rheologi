const mysql = require('mysql2/promise');

async function renamePOIdColumn() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'erp_manufacturing',
  });

  try {
    const connection = await pool.getConnection();
    
    console.log('Renaming purchase_order_id to po_id...\n');
    
    // Drop the newly created po_id column first (we just added it)
    try {
      await connection.execute('ALTER TABLE purchase_order_items DROP COLUMN po_id');
      console.log('✓ Dropped duplicate po_id column');
    } catch (e) {
      console.log('No duplicate po_id column to drop');
    }

    // Rename purchase_order_id to po_id
    await connection.execute('ALTER TABLE purchase_order_items CHANGE COLUMN purchase_order_id po_id INT NOT NULL');
    console.log('✓ Renamed purchase_order_id → po_id');

    // Check final structure
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_NAME = 'purchase_order_items' AND TABLE_SCHEMA = ?
       ORDER BY ORDINAL_POSITION`,
      [process.env.DB_NAME || 'erp_manufacturing']
    );

    console.log('\nFinal columns:');
    columns.forEach(col => {
      console.log(`  ${col.COLUMN_NAME}`);
    });

    connection.release();
    pool.end();

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

renamePOIdColumn();
