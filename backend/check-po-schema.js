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
    
    console.log('Checking purchase_orders table structure...\n');
    
    // Get table columns
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_NAME = 'purchase_orders' AND TABLE_SCHEMA = ?
       ORDER BY ORDINAL_POSITION`,
      [process.env.DB_NAME || 'erp_manufacturing']
    );

    console.log('Columns in purchase_orders:');
    columns.forEach(col => {
      console.log(`  ${col.COLUMN_NAME} (${col.COLUMN_TYPE})`);
    });

    // Check if approval columns exist
    const hasApprovalStatus = columns.some(c => c.COLUMN_NAME === 'approval_status');
    const hasApprovedBySupervisor = columns.some(c => c.COLUMN_NAME === 'approved_by_supervisor_id');
    
    console.log('\n✓ approval_status exists:', hasApprovalStatus);
    console.log('✓ approved_by_supervisor_id exists:', hasApprovedBySupervisor);

    if (!hasApprovalStatus) {
      console.log('\n⚠️ Missing approval_status column! Adding...');
      await connection.execute('ALTER TABLE purchase_orders ADD COLUMN approval_status INT DEFAULT 0');
      console.log('✓ Added approval_status');
    }

    if (!hasApprovedBySupervisor) {
      console.log('\n⚠️ Missing approval columns! Adding...');
      await connection.execute('ALTER TABLE purchase_orders ADD COLUMN approved_by_supervisor_id INT NULL');
      await connection.execute('ALTER TABLE purchase_orders ADD COLUMN approved_by_manager_id INT NULL');
      await connection.execute('ALTER TABLE purchase_orders ADD COLUMN approved_at_supervisor TIMESTAMP NULL');
      await connection.execute('ALTER TABLE purchase_orders ADD COLUMN approved_at_manager TIMESTAMP NULL');
      console.log('✓ Added all approval columns');
    }

    connection.release();
    pool.end();

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkPOSchema();
