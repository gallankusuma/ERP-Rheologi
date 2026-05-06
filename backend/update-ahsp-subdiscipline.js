const mysql = require('mysql2/promise');
require('dotenv').config();

// Mapping dari kode AHSP (2 digit pertama) ke sub-discipline
const subDisciplineMapping = {
  'A.1.1': 'Pekerjaan Persiapan',
  'A.1.2': 'Pekerjaan Bongkaran', 
  'A.1.3': 'Pekerjaan Tanah',
  'A.1.4': 'Pekerjaan Pondasi',
  'A.1.5': 'Pekerjaan Pasangan',
  'A.1.6': 'Pekerjaan Beton',
  'A.1.7': 'Beton Pracetak',
  'A.1.8': 'Pekerjaan Plesteran',
  'A.1.9': 'Pek Penutup Dinding',
  'A.1.10': 'Pek Konblok'
};

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'erp_manufacturing'
  });

  console.log('🔧 Updating AHSP Sub-Discipline Mapping...\n');

  try {
    // 1. Pastikan semua sub-discipline ada di master_sub_disciplines
    console.log('📋 Step 1: Ensuring sub-disciplines exist in master table...');
    
    const civilDisciplineId = 1; // Civil
    
    for (const [prefix, name] of Object.entries(subDisciplineMapping)) {
      const [existing] = await conn.query(
        'SELECT id FROM master_sub_disciplines WHERE name = ? AND discipline_id = ?',
        [name, civilDisciplineId]
      );
      
      if (existing.length === 0) {
        await conn.query(
          'INSERT INTO master_sub_disciplines (name, discipline_id) VALUES (?, ?)',
          [name, civilDisciplineId]
        );
        console.log(`   ✅ Created sub-discipline: ${name}`);
      } else {
        console.log(`   ⏭️  Sub-discipline exists: ${name} (ID: ${existing[0].id})`);
      }
    }
    
    // 2. Get all sub-disciplines
    const [subDisciplines] = await conn.query(
      'SELECT id, name FROM master_sub_disciplines WHERE discipline_id = ?',
      [civilDisciplineId]
    );
    
    const subDisciplineMap = {};
    subDisciplines.forEach(row => {
      subDisciplineMap[row.name] = row.id;
    });
    
    console.log('\n📋 Step 2: Mapping AHSP to sub-disciplines based on code prefix...');
    
    // 3. Clear existing mappings
    await conn.query('DELETE FROM ahsp_sub_discipline_map');
    console.log('   🗑️  Cleared existing mappings');
    
    // 4. Get all AHSP
    const [ahspList] = await conn.query('SELECT id, kode FROM ahsp_headers');
    
    let mapped = 0;
    let unmapped = 0;
    const stats = {};
    
    for (const ahsp of ahspList) {
      let matchedSubDiscipline = null;
      
      // Try to match with 6 chars first (A.1.10)
      const prefix6 = ahsp.kode.substring(0, 6);
      if (subDisciplineMapping[prefix6]) {
        matchedSubDiscipline = subDisciplineMapping[prefix6];
      }
      
      // Try to match with 5 chars (A.1.1 - A.1.9)
      if (!matchedSubDiscipline) {
        const prefix5 = ahsp.kode.substring(0, 5);
        if (subDisciplineMapping[prefix5]) {
          matchedSubDiscipline = subDisciplineMapping[prefix5];
        }
      }
      
      if (matchedSubDiscipline && subDisciplineMap[matchedSubDiscipline]) {
        const subDisciplineId = subDisciplineMap[matchedSubDiscipline];
        
        await conn.query(
          'INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id) VALUES (?, ?)',
          [ahsp.id, subDisciplineId]
        );
        
        mapped++;
        stats[matchedSubDiscipline] = (stats[matchedSubDiscipline] || 0) + 1;
      } else {
        unmapped++;
        console.log(`   ⚠️  Unmapped: ${ahsp.kode}`);
      }
    }
    
    console.log('\n✅ Mapping complete!');
    console.log(`   - Mapped: ${mapped} AHSP`);
    console.log(`   - Unmapped: ${unmapped} AHSP`);
    
    console.log('\n📊 Distribution by Sub-Discipline:');
    Object.entries(stats)
      .sort((a, b) => b[1] - a[1])
      .forEach(([name, count]) => {
        console.log(`   - ${name}: ${count} AHSP`);
      });
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await conn.end();
  }
})();
