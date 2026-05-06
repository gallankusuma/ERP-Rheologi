const mysql = require('mysql2/promise');

async function checkPOItemsSchema() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'erp_manufacturing',
  });

  try {
    const connection = await pool.getConnection();
    
    console.log('Checking purchase_order_items table structure...\n');
    
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_NAME = 'purchase_order_items' AND TABLE_SCHEMA = ?
       ORDER BY ORDINAL_POSITION`,
      [process.env.DB_NAME || 'erp_manufacturing']
    );

    console.log('Columns:');
    columns.forEach(col => {
      console.log(`  ${col.COLUMN_NAME}`);
    });

    const hasPoId = columns.some(c => c.COLUMN_NAME === 'po_id');
    
    if (!hasPoId) {
      console.log('\n⚠️ Missing po_id column! Adding...');
      await connection.execute('ALTER TABLE purchase_order_items ADD COLUMN po_id INT NOT NULL AFTER id');
      await connection.execute('ALTER TABLE purchase_order_items ADD FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE');
      console.log('✓ Added po_id column with foreign key');
    } else {
      console.log('\n✓ po_id column exists');
    }

    connection.release();
    pool.end();

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkPOItemsSchema();
