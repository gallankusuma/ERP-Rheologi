const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'erp_manufacturing'
  });

  console.log('📊 AHSP Import & Sync Report\n');
  console.log('='.repeat(60));

  // Count headers
  const [headers] = await conn.query('SELECT COUNT(*) as total FROM ahsp_headers');
  const [items] = await conn.query('SELECT COUNT(*) as total FROM ahsp_items');
  
  // Count matched vs unmatched
  const [matched] = await conn.query('SELECT COUNT(*) as total FROM ahsp_items WHERE resource_id > 0');
  const [unmatched] = await conn.query('SELECT COUNT(*) as total FROM ahsp_items WHERE resource_id = 0 OR resource_id IS NULL');
  
  // Count AHSP with prices
  const [withPrice] = await conn.query('SELECT COUNT(*) as total FROM ahsp_headers WHERE harga_satuan > 0');
  const [noPrice] = await conn.query('SELECT COUNT(*) as total FROM ahsp_headers WHERE harga_satuan = 0 OR harga_satuan IS NULL');

  // Get master data counts
  const [laborCount] = await conn.query('SELECT COUNT(*) as total FROM master_labor WHERE is_active = 1');
  const [materialCount] = await conn.query('SELECT COUNT(*) as total FROM master_materials WHERE is_active = 1');
  const [equipmentCount] = await conn.query('SELECT COUNT(*) as total FROM master_equipment WHERE is_active = 1');

  console.log('📋 AHSP Data:');
  console.log(`   Total AHSP Headers: ${headers[0].total}`);
  console.log(`   Total Resources Items: ${items[0].total}`);
  console.log(`   Items dengan harga: ${matched[0].total} (${Math.round(matched[0].total/items[0].total*100)}%)`);
  console.log(`   Items tanpa harga: ${unmatched[0].total} (${Math.round(unmatched[0].total/items[0].total*100)}%)`);
  console.log('');
  console.log(`   AHSP dengan harga lengkap: ${withPrice[0].total} (${Math.round(withPrice[0].total/headers[0].total*100)}%)`);
  console.log(`   AHSP tanpa harga: ${noPrice[0].total} (${Math.round(noPrice[0].total/headers[0].total*100)}%)`);

  console.log('\n💾 Master Data:');
  console.log(`   Labor (Tenaga Kerja): ${laborCount[0].total} items`);
  console.log(`   Materials (Bahan): ${materialCount[0].total} items`);
  console.log(`   Equipment (Peralatan): ${equipmentCount[0].total} items`);

  // Top 10 AHSP by price
  const [top10] = await conn.query(`
    SELECT kode, name, harga_satuan 
    FROM ahsp_headers 
    WHERE harga_satuan > 0 
    ORDER BY harga_satuan DESC 
    LIMIT 10
  `);

  console.log('\n🏆 Top 10 AHSP by Price:');
  top10.forEach((r, i) => {
    const price = parseFloat(r.harga_satuan).toLocaleString('id-ID', { style: 'currency', currency: 'IDR' });
    console.log(`   ${i+1}. ${r.kode} - ${r.name.substring(0, 45)}...`);
    console.log(`      ${price}`);
  });

  // Bottom 10 AHSP (no price or lowest)
  const [bottom] = await conn.query(`
    SELECT kode, name, harga_satuan 
    FROM ahsp_headers 
    WHERE harga_satuan = 0 OR harga_satuan IS NULL
    LIMIT 10
  `);

  if (bottom.length > 0) {
    console.log('\n⚠️  AHSP without Price (sample 10):');
    bottom.forEach((r, i) => {
      console.log(`   ${i+1}. ${r.kode} - ${r.name.substring(0, 50)}`);
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log('✨ Report generated successfully!');

  await conn.end();
})().catch(console.error);
