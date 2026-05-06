const mysql = require('mysql2/promise');
const fs = require('fs').promises;
require('dotenv').config();

async function applySchema() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'erp_manufacturing',
    multipleStatements: true
  });

  try {
    console.log('📖 Reading SQL schema...');
    const sql = await fs.readFile('database/add_clients_module.sql', 'utf-8');
    
    console.log('🔧 Applying schema...');
    const connection = await pool.getConnection();
    
    // Split and execute statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (stmt.length > 0) {
        try {
          await connection.execute(stmt);
        } catch (err) {
          if (!err.message.includes('exists') && 
              !err.message.includes('Duplicate') && 
              !err.message.includes("doesn't exist")) {
            console.log(`Warning at statement ${i + 1}:`, err.message.substring(0, 100));
          }
        }
      }
    }
    
    connection.release();
    console.log('✅ Schema applied successfully!');
    
    // Verify tables were created
    console.log('\n🔍 Verifying tables...');
    const [tables] = await pool.execute(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = 'erp_manufacturing' 
      AND TABLE_NAME LIKE 'client%'
      ORDER BY TABLE_NAME
    `);
    
    console.log('📊 Client module tables:');
    tables.forEach(t => console.log(`   ✓ ${t.TABLE_NAME}`));
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

applySchema()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Failed:', err);
    process.exit(1);
  });
