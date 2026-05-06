const mysql = require('mysql2/promise');

async function dropFKAndFixColumn() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'erp_manufacturing',
  });

  try {
    const connection = await pool.getConnection();
    
    console.log('Finding and dropping foreign key constraint...\n');
    
    // Get foreign keys
    const [fks] = await connection.execute(
      `SELECT CONSTRAINT_NAME 
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
       WHERE TABLE_NAME = 'purchase_order_items' 
       AND TABLE_SCHEMA = ? 
       AND COLUMN_NAME = 'po_id' 
       AND REFERENCED_TABLE_NAME IS NOT NULL`,
      [process.env.DB_NAME || 'erp_manufacturing']
    );

    if (fks.length > 0) {
      for (const fk of fks) {
        console.log(`Dropping FK: ${fk.CONSTRAINT_NAME}`);
        await connection.execute(`ALTER TABLE purchase_order_items DROP FOREIGN KEY ${fk.CONSTRAINT_NAME}`);
      }
    }

    // Drop po_id column
    console.log('Dropping po_id column...');
    await connection.execute('ALTER TABLE purchase_order_items DROP COLUMN po_id');
    console.log('✓ Dropped po_id');

    // Rename purchase_order_id to po_id
    console.log('Renaming purchase_order_id → po_id...');
    await connection.execute('ALTER TABLE purchase_order_items CHANGE COLUMN purchase_order_id po_id INT NOT NULL');
    console.log('✓ Renamed');

    // Re-add foreign key
    console.log('Adding foreign key constraint...');
    await connection.execute('ALTER TABLE purchase_order_items ADD FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE');
    console.log('✓ FK added');

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

dropFKAndFixColumn();
