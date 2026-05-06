/**
 * Sync Harga Satuan Dasar (Master Prices) from ahsp_items
 * 
 * Extracts unique resources from ahsp_items and upserts into:
 *   - master_labor      (tenaga/labor)
 *   - master_materials   (bahan/material)
 *   - master_equipment   (peralatan/equipment)
 * 
 * Usage: node scripts/sync-master-prices.js
 */

const mysql = require('mysql2/promise');

async function main() {
  const db = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'erp_manufacturing',
  });

  console.log('=== Sync Harga Satuan Dasar from AHSP Items ===\n');

  // Get distinct resources from ahsp_items, take the latest (highest) price per name+satuan
  const [resources] = await db.query(`
    SELECT resource_type, resource_name, resource_satuan,
           MAX(resource_harga) as harga
    FROM ahsp_items
    WHERE resource_name IS NOT NULL AND resource_name != ''
    GROUP BY resource_type, resource_name, resource_satuan
    ORDER BY resource_type, resource_name
  `);

  console.log(`Found ${resources.length} unique resources in ahsp_items\n`);

  const stats = { labor: { added: 0, updated: 0, skipped: 0 }, material: { added: 0, updated: 0, skipped: 0 }, equipment: { added: 0, updated: 0, skipped: 0 } };

  // --- LABOR ---
  const laborItems = resources.filter(r => r.resource_type === 'labor');
  console.log(`📋 Labor (Tenaga): ${laborItems.length} unique`);

  const [existingLabor] = await db.query('SELECT id, name, satuan, harga FROM master_labor WHERE is_active = 1');
  const [maxLaborCode] = await db.query("SELECT MAX(CAST(SUBSTRING(code, 3) AS UNSIGNED)) as maxNum FROM master_labor WHERE code LIKE 'L.%'");
  let laborCodeNum = (maxLaborCode[0].maxNum || 0);

  for (const item of laborItems) {
    const existing = existingLabor.find(e => e.name === item.resource_name && e.satuan === item.resource_satuan);
    if (existing) {
      if (parseFloat(existing.harga) !== parseFloat(item.harga)) {
        await db.query('UPDATE master_labor SET harga = ? WHERE id = ?', [item.harga, existing.id]);
        stats.labor.updated++;
      } else {
        stats.labor.skipped++;
      }
    } else {
      laborCodeNum++;
      const code = `L.${String(laborCodeNum).padStart(2, '0')}`;
      await db.query(
        'INSERT INTO master_labor (code, name, satuan, harga, is_active) VALUES (?, ?, ?, ?, 1)',
        [code, item.resource_name, item.resource_satuan, item.harga]
      );
      stats.labor.added++;
    }
  }
  console.log(`  Added: ${stats.labor.added}  Updated: ${stats.labor.updated}  Unchanged: ${stats.labor.skipped}`);

  // --- MATERIALS ---
  const materialItems = resources.filter(r => r.resource_type === 'material');
  console.log(`\n📋 Materials (Bahan): ${materialItems.length} unique`);

  const [existingMat] = await db.query('SELECT id, name, satuan, harga FROM master_materials WHERE is_active = 1');
  const [maxMatCode] = await db.query("SELECT MAX(CAST(SUBSTRING(code, 3) AS UNSIGNED)) as maxNum FROM master_materials WHERE code LIKE 'M.%'");
  let matCodeNum = (maxMatCode[0].maxNum || 0);

  for (const item of materialItems) {
    const existing = existingMat.find(e => e.name === item.resource_name && e.satuan === item.resource_satuan);
    if (existing) {
      if (parseFloat(existing.harga) !== parseFloat(item.harga)) {
        await db.query('UPDATE master_materials SET harga = ? WHERE id = ?', [item.harga, existing.id]);
        stats.material.updated++;
      } else {
        stats.material.skipped++;
      }
    } else {
      matCodeNum++;
      const code = `M.${String(matCodeNum).padStart(4, '0')}`;
      await db.query(
        'INSERT INTO master_materials (code, name, satuan, harga, is_active) VALUES (?, ?, ?, ?, 1)',
        [code, item.resource_name, item.resource_satuan, item.harga]
      );
      stats.material.added++;
    }
  }
  console.log(`  Added: ${stats.material.added}  Updated: ${stats.material.updated}  Unchanged: ${stats.material.skipped}`);

  // --- EQUIPMENT ---
  const equipItems = resources.filter(r => r.resource_type === 'equipment');
  console.log(`\n📋 Equipment (Alat): ${equipItems.length} unique`);

  const [existingEquip] = await db.query('SELECT id, name, satuan, harga FROM master_equipment WHERE is_active = 1');
  const [maxEquipCode] = await db.query("SELECT MAX(CAST(SUBSTRING(code, 3) AS UNSIGNED)) as maxNum FROM master_equipment WHERE code LIKE 'E.%'");
  let equipCodeNum = (maxEquipCode[0].maxNum || 0);

  for (const item of equipItems) {
    const existing = existingEquip.find(e => e.name === item.resource_name && e.satuan === item.resource_satuan);
    if (existing) {
      if (parseFloat(existing.harga) !== parseFloat(item.harga)) {
        await db.query('UPDATE master_equipment SET harga = ? WHERE id = ?', [item.harga, existing.id]);
        stats.equipment.updated++;
      } else {
        stats.equipment.skipped++;
      }
    } else {
      equipCodeNum++;
      const code = `E.${String(equipCodeNum).padStart(3, '0')}`;
      await db.query(
        'INSERT INTO master_equipment (code, name, satuan, harga, is_active) VALUES (?, ?, ?, ?, 1)',
        [code, item.resource_name, item.resource_satuan, item.harga]
      );
      stats.equipment.added++;
    }
  }
  console.log(`  Added: ${stats.equipment.added}  Updated: ${stats.equipment.updated}  Unchanged: ${stats.equipment.skipped}`);

  // Also link ahsp_items.resource_id to the master table IDs
  console.log('\n🔗 Linking ahsp_items.resource_id to master tables...');

  const [allLabor] = await db.query('SELECT id, name, satuan FROM master_labor WHERE is_active = 1');
  const [allMat] = await db.query('SELECT id, name, satuan FROM master_materials WHERE is_active = 1');
  const [allEquip] = await db.query('SELECT id, name, satuan FROM master_equipment WHERE is_active = 1');

  let linked = 0;
  for (const labor of allLabor) {
    const [res] = await db.query(
      'UPDATE ahsp_items SET resource_id = ? WHERE resource_type = ? AND resource_name = ? AND resource_satuan = ? AND (resource_id = 0 OR resource_id IS NULL)',
      [labor.id, 'labor', labor.name, labor.satuan]
    );
    linked += res.affectedRows;
  }
  for (const mat of allMat) {
    const [res] = await db.query(
      'UPDATE ahsp_items SET resource_id = ? WHERE resource_type = ? AND resource_name = ? AND resource_satuan = ? AND (resource_id = 0 OR resource_id IS NULL)',
      [mat.id, 'material', mat.name, mat.satuan]
    );
    linked += res.affectedRows;
  }
  for (const equip of allEquip) {
    const [res] = await db.query(
      'UPDATE ahsp_items SET resource_id = ? WHERE resource_type = ? AND resource_name = ? AND resource_satuan = ? AND (resource_id = 0 OR resource_id IS NULL)',
      [equip.id, 'equipment', equip.name, equip.satuan]
    );
    linked += res.affectedRows;
  }
  console.log(`  Linked ${linked} ahsp_item rows to master IDs`);

  // Summary
  const totalAdded = stats.labor.added + stats.material.added + stats.equipment.added;
  const totalUpdated = stats.labor.updated + stats.material.updated + stats.equipment.updated;
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`✅ Done! Added: ${totalAdded}  Updated: ${totalUpdated}`);
  console.log(`${'═'.repeat(50)}\n`);

  await db.end();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
