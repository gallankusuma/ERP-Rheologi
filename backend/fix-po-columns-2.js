const mysql = require('mysql2/promise');

async function fixPOColumns() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'erp_manufacturing',
  });

  try {
    const connection = await pool.getConnection();

    const getColumns = async (table) => {
      const [cols] = await connection.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_NAME = ? AND TABLE_SCHEMA = ?`,
        [table, process.env.DB_NAME || 'erp_manufacturing']
      );
      return new Set(cols.map(c => c.COLUMN_NAME));
    };

    console.log('Checking purchase_orders columns...');
    const poCols = await getColumns('purchase_orders');

    if (!poCols.has('currency')) {
      await connection.execute('ALTER TABLE purchase_orders ADD COLUMN currency VARCHAR(10) DEFAULT "IDR"');
      console.log('✓ Added purchase_orders.currency');
    }

    if (!poCols.has('payment_term_2')) {
      await connection.execute('ALTER TABLE purchase_orders ADD COLUMN payment_term_2 VARCHAR(100) NULL');
      console.log('✓ Added purchase_orders.payment_term_2');
    }

    console.log('Checking purchase_order_items columns...');
    const poiCols = await getColumns('purchase_order_items');

    if (!poiCols.has('uom')) {
      await connection.execute('ALTER TABLE purchase_order_items ADD COLUMN uom VARCHAR(50) NULL');
      console.log('✓ Added purchase_order_items.uom');
    }

    if (!poiCols.has('currency')) {
      await connection.execute('ALTER TABLE purchase_order_items ADD COLUMN currency VARCHAR(10) DEFAULT "IDR"');
      console.log('✓ Added purchase_order_items.currency');
    }

    console.log('Done.');
    connection.release();
    pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

fixPOColumns();
