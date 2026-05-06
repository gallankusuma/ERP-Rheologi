const mysql = require('mysql2/promise');

async function checkAndFixApprovalStatus() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'erp_manufacturing',
  });

  try {
    const connection = await pool.getConnection();
    console.log('Checking purchase_requests table structure...\n');

    // Get all columns
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_NAME = 'purchase_requests' AND TABLE_SCHEMA = ?
       ORDER BY ORDINAL_POSITION`,
      [process.env.DB_NAME || 'erp_manufacturing']
    );

    console.log('Current columns:');
    columns.forEach(col => {
      console.log(`  - ${col.COLUMN_NAME} (${col.COLUMN_TYPE})`);
    });

    // Check if approval_status exists
    const hasApprovalStatus = columns.some(c => c.COLUMN_NAME === 'approval_status');
    
    if (!hasApprovalStatus) {
      console.log('\n❌ approval_status column is missing. Adding it now...');
      
      // Try adding with different syntax
      try {
        await connection.execute(
          'ALTER TABLE purchase_requests ADD COLUMN approval_status INT DEFAULT 0'
        );
        console.log('✓ Successfully added approval_status column');
      } catch (err) {
        console.error('Error adding approval_status:', err.message);
      }
    } else {
      console.log('\n✓ approval_status column already exists');
    }

    // Verify final state
    const [finalColumns] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_NAME = 'purchase_requests' AND TABLE_SCHEMA = ?`,
      [process.env.DB_NAME || 'erp_manufacturing']
    );

    console.log('\nFinal verification - Required columns for approval workflow:');
    const requiredCols = ['approval_status', 'approved_by_supervisor_id', 'approved_by_manager_id', 'approved_at_supervisor', 'approved_at_manager'];
    const finalColNames = finalColumns.map(c => c.COLUMN_NAME);
    
    let allPresent = true;
    requiredCols.forEach(col => {
      if (finalColNames.includes(col)) {
        console.log(`  ✓ ${col}`);
      } else {
        console.log(`  ✗ ${col} - MISSING`);
        allPresent = false;
      }
    });

    if (allPresent) {
      console.log('\n✅ All approval workflow columns are present!');
    } else {
      console.log('\n⚠️ Some columns are still missing');
    }

    connection.release();
    pool.end();

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkAndFixApprovalStatus();
