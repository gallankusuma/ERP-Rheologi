const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'erp_manufacturing'
  });

  console.log('🔧 Adding discipline_id to ahsp_headers...\n');

  try {
    // Check if column exists
    const [columns] = await conn.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'ahsp_headers' AND COLUMN_NAME = 'discipline_id'
    `, [process.env.DB_NAME || 'erp_manufacturing']);

    if (columns.length > 0) {
      console.log('✅ Column discipline_id already exists');
    } else {
      // Add column
      await conn.query(`
        ALTER TABLE ahsp_headers 
        ADD COLUMN discipline_id INT NULL AFTER status,
        ADD CONSTRAINT fk_ahsp_discipline FOREIGN KEY (discipline_id) REFERENCES master_disciplines(id)
      `);
      console.log('✅ Added discipline_id column');
    }

    // Update all existing AHSP to have discipline_id from their sub_discipline
    console.log('\n🔄 Updating discipline_id for existing AHSP...\n');
    
    const [result] = await conn.query(`
      UPDATE ahsp_headers h
      JOIN ahsp_sub_discipline_map m ON h.id = m.ahsp_id
      JOIN master_sub_disciplines s ON m.sub_discipline_id = s.id
      SET h.discipline_id = s.discipline_id
      WHERE h.discipline_id IS NULL
    `);

    console.log(`✅ Updated ${result.affectedRows} AHSP records with discipline_id`);

    // Set default discipline_id = 1 (Civil) for AHSP without mapping
    const [result2] = await conn.query(`
      UPDATE ahsp_headers 
      SET discipline_id = 1 
      WHERE discipline_id IS NULL
    `);

    console.log(`✅ Set default discipline_id for ${result2.affectedRows} unmapped AHSP`);

    // Show summary
    const [summary] = await conn.query(`
      SELECT 
        d.name as discipline_name,
        COUNT(h.id) as ahsp_count
      FROM ahsp_headers h
      LEFT JOIN master_disciplines d ON h.discipline_id = d.id
      GROUP BY d.name
    `);

    console.log('\n📊 AHSP by Discipline:');
    summary.forEach(r => {
      console.log(`   ${r.discipline_name || 'NO DISCIPLINE'}: ${r.ahsp_count} AHSP`);
    });

    await conn.end();
    console.log('\n✨ Migration completed!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    await conn.end();
    process.exit(1);
  }
})();
