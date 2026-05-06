const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'erp_manufacturing',
    multipleStatements: true
  });

  try {
    console.log('📋 Running migration: Add description column...');
    
    const sqlPath = path.join(__dirname, 'database', 'add_description_column.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    await connection.query(sql);
    
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigration();
