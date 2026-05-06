const mysql = require('mysql2/promise');

async function checkSchema() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'erp_manufacturing',
  });

  try {
    console.log('🔍 Checking goods_receipts table schema...\n');
    
    const [columns] = await connection.query(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'goods_receipts'
       ORDER BY ORDINAL_POSITION`
    );
    
    console.log('📋 Current columns in goods_receipts table:');
    console.table(columns);
    
    // Check if approval status columns exist
    const columnNames = columns.map((col) => col.COLUMN_NAME);
    
    console.log('\n✅ Column checklist:');
    const requiredColumns = [
      'id', 'grn_number', 'gr_number', 'po_id', 'warehouse_id', 
      'received_date', 'received_by', 'status', 'notes',
      'approval_status', 'approved_by_supervisor_id', 'approved_by_manager_id'
    ];
    
    requiredColumns.forEach(col => {
      const exists = columnNames.includes(col);
      console.log(`  ${exists ? '✓' : '✗'} ${col}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkSchema();
