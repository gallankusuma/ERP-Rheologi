const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

async function addVendorColumns() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'erp_manufacturing'
  });

  try {
    console.log('🔗 Connected to MySQL database');
    
    const sqlPath = path.join(__dirname, 'backend', 'database', 'add_vendor_columns.sql');
    const sql = await fs.readFile(sqlPath, 'utf-8');
    
    const statements = sql.split(';').filter(s => s.trim().length > 0);
    
    for (const statement of statements) {
      try {
        await connection.execute(statement);
        console.log('✅ Executed:', statement.substring(0, 60) + '...');
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
          console.log('⚠️ Column already exists, skipping...');
        } else {
          console.error('❌ Error:', err.message);
        }
      }
    }
    
    console.log('\n✅ Vendor columns added successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await connection.end();
  }
}

addVendorColumns();
