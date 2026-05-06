const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'erp_manufacturing'
  });

  const [headers] = await conn.query('SELECT COUNT(*) as total FROM ahsp_headers');
  const [items] = await conn.query('SELECT COUNT(*) as total FROM ahsp_items');
  
  console.log('📊 Import Results:');
  console.log(`   Headers: ${headers[0].total} AHSP`);
  console.log(`   Items: ${items[0].total} resource items`);
  
  const [sample] = await conn.query('SELECT kode, name, harga_satuan FROM ahsp_headers ORDER BY id DESC LIMIT 5');
  console.log('\n🔍 Last 5 AHSP:');
  sample.forEach(r => {
    console.log(`   ${r.kode} - ${r.name.substring(0, 50)} (Rp ${r.harga_satuan || 0})`);
  });
  
  await conn.end();
})().catch(console.error);
