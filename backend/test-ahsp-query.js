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
    // Test the exact query from API
    const [results] = await conn.query(`
      SELECT DISTINCT 
        h.id, h.kode, h.name, h.satuan, h.harga_satuan,
        h.discipline_id,
        d.name as discipline_name,
        m.sub_discipline_id,
        s.name as sub_discipline_name
      FROM ahsp_headers h
      LEFT JOIN master_disciplines d ON h.discipline_id = d.id
      LEFT JOIN ahsp_sub_discipline_map m ON h.id = m.ahsp_id
      LEFT JOIN master_sub_disciplines s ON m.sub_discipline_id = s.id
      WHERE h.status = 'active'
      ORDER BY h.kode ASC
      LIMIT 10
    `);
    
    console.log('📊 Sample AHSP with Discipline & Sub-Discipline:\n');
    
    results.forEach((row, idx) => {
      console.log(`${idx + 1}. ${row.kode} - ${row.name.substring(0, 50)}...`);
      console.log(`   Discipline ID: ${row.discipline_id}`);
      console.log(`   Discipline: ${row.discipline_name || '(NULL)'}`);
      console.log(`   Sub-Discipline ID: ${row.sub_discipline_id}`);
      console.log(`   Sub-Discipline: ${row.sub_discipline_name || '(NULL)'}`);
      console.log(`   Harga: Rp ${row.harga_satuan}\n`);
    });
    
    // Check counts
    const [counts] = await conn.query(`
      SELECT 
        COUNT(DISTINCT h.id) as total_ahsp,
        COUNT(DISTINCT CASE WHEN h.discipline_id IS NOT NULL THEN h.id END) as with_discipline,
        COUNT(DISTINCT CASE WHEN m.sub_discipline_id IS NOT NULL THEN h.id END) as with_sub_discipline
      FROM ahsp_headers h
      LEFT JOIN ahsp_sub_discipline_map m ON h.id = m.ahsp_id
      WHERE h.status = 'active'
    `);
    
    console.log('📈 Statistics:');
    console.log(`   Total AHSP: ${counts[0].total_ahsp}`);
    console.log(`   With Discipline: ${counts[0].with_discipline}`);
    console.log(`   With Sub-Discipline: ${counts[0].with_sub_discipline}`);
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await conn.end();
  }
})();
