const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'erp_manufacturing'
  });

  try {
    const [headers] = await conn.query('SELECT COUNT(*) as count FROM ahsp_headers');
    const [items] = await conn.query('SELECT COUNT(*) as count FROM ahsp_items');
    
    console.log('📊 Current AHSP Data in Database:');
    console.log(`   - AHSP Headers: ${headers[0].count}`);
    console.log(`   - AHSP Items: ${items[0].count}`);
    
    // Sample data
    const [sample] = await conn.query(`
      SELECT kode, name, satuan, harga_satuan, discipline_id 
      FROM ahsp_headers 
      LIMIT 5
    `);
    
    console.log('\n📋 Sample AHSP Headers:');
    sample.forEach(row => {
      console.log(`   ${row.kode} - ${row.name.substring(0, 50)}... (${row.harga_satuan})`);
    });
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await conn.end();
  }
})();
