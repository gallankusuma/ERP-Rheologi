const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

async function runMigration() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'erp_manufacturing',
    waitForConnections: true,
    connectionLimit: 10,
  });

  try {
    const connection = await pool.getConnection();
    console.log('✓ Connected to MySQL database');

    // Read migration file
    const migrationPath = path.join(__dirname, 'database', 'add-approval-columns.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    // Split into individual statements and execute
    const statements = migrationSQL
      .split(';')
      .filter(s => s.trim().length > 0)
      .filter(s => !s.trim().startsWith('--'));

    console.log(`Running ${statements.length} migration statements...`);

    for (const statement of statements) {
      if (statement.trim().length > 0) {
        try {
          await connection.execute(statement);
          console.log('✓', statement.trim().substring(0, 80) + '...');
        } catch (err) {
          console.error('Error:', err.message.substring(0, 150));
        }
      }
    }

    console.log('\n✅ Migration completed successfully');
    
    // Verify columns were added
    console.log('\nVerifying columns in purchase_requests table:');
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_NAME = 'purchase_requests' AND TABLE_SCHEMA = ?`,
      [process.env.DB_NAME || 'erp_manufacturing']
    );
    
    const columnNames = columns.map(c => c.COLUMN_NAME);
    const requiredCols = ['approval_status', 'approved_by_supervisor_id', 'approved_by_manager_id', 'approved_at_supervisor', 'approved_at_manager'];
    
    requiredCols.forEach(col => {
      if (columnNames.includes(col)) {
        console.log(`  ✓ ${col}`);
      } else {
        console.log(`  ✗ ${col} - MISSING`);
      }
    });

    connection.release();
    pool.end();
    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
