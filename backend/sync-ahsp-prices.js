const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'erp_manufacturing'
  });

  console.log('🔄 Syncing AHSP prices with master data...\n');

  // Get all AHSP items with zero price
  const [items] = await conn.query(`
    SELECT id, ahsp_id, section, resource_type, resource_name, resource_satuan, koefisien, resource_harga
    FROM ahsp_items
    WHERE resource_harga = 0 OR resource_harga IS NULL
    ORDER BY id
  `);

  console.log(`📊 Found ${items.length} items with zero price\n`);

  let matchedLabor = 0;
  let matchedMaterial = 0;
  let matchedEquipment = 0;
  let notMatched = 0;

  for (const item of items) {
    let matched = false;
    let masterData = null;
    let masterTable = null;

    // Determine which master table to use based on section
    if (item.section === 'A') {
      // Labor - try to match with master_labor
      const [labor] = await conn.query(
        'SELECT id, name, harga FROM master_labor WHERE LOWER(name) = LOWER(?) AND is_active = 1 LIMIT 1',
        [item.resource_name]
      );
      if (labor.length > 0) {
        masterData = labor[0];
        masterTable = 'master_labor';
        matchedLabor++;
        matched = true;
      }
    } else if (item.section === 'B') {
      // Material - try to match with master_materials
      const [material] = await conn.query(
        'SELECT id, name, harga FROM master_materials WHERE LOWER(name) = LOWER(?) AND is_active = 1 LIMIT 1',
        [item.resource_name]
      );
      if (material.length > 0) {
        masterData = material[0];
        masterTable = 'master_materials';
        matchedMaterial++;
        matched = true;
      }
      
      // Try fuzzy match if exact not found
      if (!matched && item.resource_name) {
        const searchName = item.resource_name.replace(/\s+/g, '%');
        const [fuzzy] = await conn.query(
          'SELECT id, name, harga FROM master_materials WHERE LOWER(name) LIKE LOWER(?) AND is_active = 1 LIMIT 1',
          [`%${searchName}%`]
        );
        if (fuzzy.length > 0) {
          masterData = fuzzy[0];
          masterTable = 'master_materials';
          matchedMaterial++;
          matched = true;
        }
      }
    } else if (item.section === 'C') {
      // Equipment - try to match with master_equipment
      const [equipment] = await conn.query(
        'SELECT id, name, harga FROM master_equipment WHERE LOWER(name) = LOWER(?) AND is_active = 1 LIMIT 1',
        [item.resource_name]
      );
      if (equipment.length > 0) {
        masterData = equipment[0];
        masterTable = 'master_equipment';
        matchedEquipment++;
        matched = true;
      }
    }

    if (matched && masterData) {
      const harga = parseFloat(masterData.harga);
      const jumlahHarga = parseFloat(item.koefisien) * harga;
      
      // Update ahsp_items with matched price
      await conn.query(
        `UPDATE ahsp_items 
         SET resource_id = ?, resource_harga = ?, jumlah_harga = ?
         WHERE id = ?`,
        [masterData.id, harga, jumlahHarga, item.id]
      );

      console.log(`✓ ${item.resource_name} → ${masterData.name} (Rp ${harga.toLocaleString('id-ID')})`);
    } else {
      notMatched++;
      if (notMatched <= 10) { // Only show first 10
        console.log(`✗ ${item.section} - ${item.resource_name} (no match)`);
      }
    }
  }

  console.log('\n📊 Sync Summary:');
  console.log(`   ✅ Labor matched: ${matchedLabor}`);
  console.log(`   ✅ Material matched: ${matchedMaterial}`);
  console.log(`   ✅ Equipment matched: ${matchedEquipment}`);
  console.log(`   ❌ Not matched: ${notMatched}`);
  console.log(`   📈 Total processed: ${items.length}`);

  // Recalculate totals for all affected AHSP
  console.log('\n🔄 Recalculating AHSP totals...\n');
  
  const [ahspList] = await conn.query('SELECT DISTINCT ahsp_id FROM ahsp_items WHERE ahsp_id IS NOT NULL');
  
  for (const ahsp of ahspList) {
    const [itemData] = await conn.query(
      'SELECT section, koefisien, resource_harga FROM ahsp_items WHERE ahsp_id = ?',
      [ahsp.ahsp_id]
    );

    let hargaTenaga = 0;
    let hargaBahan = 0;
    let hargaAlat = 0;

    itemData.forEach(item => {
      const jumlah = parseFloat(item.koefisien || 0) * parseFloat(item.resource_harga || 0);
      if (item.section === 'A') hargaTenaga += jumlah;
      else if (item.section === 'B') hargaBahan += jumlah;
      else if (item.section === 'C') hargaAlat += jumlah;
    });

    const hargaLangsung = hargaTenaga + hargaBahan + hargaAlat;
    const overheadProfit = hargaLangsung * 0.1;
    const hargaSatuan = hargaLangsung + overheadProfit;

    await conn.query(
      `UPDATE ahsp_headers 
       SET harga_tenaga = ?, harga_bahan = ?, harga_alat = ?,
           harga_langsung = ?, overhead_profit = ?, harga_satuan = ?
       WHERE id = ?`,
      [hargaTenaga, hargaBahan, hargaAlat, hargaLangsung, overheadProfit, hargaSatuan, ahsp.ahsp_id]
    );
  }

  console.log(`✅ Recalculated ${ahspList.length} AHSP totals`);

  // Show sample results
  const [updated] = await conn.query(`
    SELECT kode, name, harga_satuan 
    FROM ahsp_headers 
    WHERE harga_satuan > 0 
    ORDER BY harga_satuan DESC 
    LIMIT 5
  `);

  console.log('\n🏆 Top 5 AHSP by price:');
  updated.forEach(r => {
    console.log(`   ${r.kode} - ${r.name.substring(0, 50)} = Rp ${parseFloat(r.harga_satuan).toLocaleString('id-ID')}`);
  });

  await conn.end();
  console.log('\n✨ Sync completed!');
})().catch(console.error);
