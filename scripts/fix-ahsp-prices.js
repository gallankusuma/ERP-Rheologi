/**
 * Fix AHSP prices by re-matching resource_harga from master tables
 * The copyFromRef function used reference prices instead of master prices
 */
const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'erp_user',
    password: 'ErpSecure2024!',
    database: 'erp_manufacturing'
  });

  console.log('Connected. Loading master data...');

  // Load master data indexed by name (lowercase for matching)
  const [laborRows] = await conn.query('SELECT id, name, satuan, harga FROM master_labor');
  const [materialRows] = await conn.query('SELECT id, name, satuan, harga FROM master_materials');
  const [equipmentRows] = await conn.query('SELECT id, name, satuan, harga FROM master_equipment');

  const laborByName = {};
  laborRows.forEach(r => { laborByName[r.name.toLowerCase().trim()] = r; });
  const materialByName = {};
  materialRows.forEach(r => { materialByName[r.name.toLowerCase().trim()] = r; });
  const equipmentByName = {};
  equipmentRows.forEach(r => { equipmentByName[r.name.toLowerCase().trim()] = r; });

  function findBestMatch(name, table) {
    const key = name.toLowerCase().trim();
    // Exact match
    if (table[key]) return table[key];
    // Substring match (table key contains search term)
    for (const k of Object.keys(table)) {
      if (k.includes(key)) return table[k];
    }
    // Reverse substring (search term contains table key)
    for (const k of Object.keys(table)) {
      if (key.includes(k) && k.length > 3) return table[k];
    }
    // Word match (first significant word)
    const words = key.split(/[\s\/\-]+/).filter(w => w.length > 3);
    for (const w of words) {
      for (const k of Object.keys(table)) {
        if (k.includes(w)) return table[k];
      }
    }
    return null;
  }

  // Get all ahsp_items for our 289 template AHSP
  const [items] = await conn.query(`
    SELECT i.id, i.ahsp_id, i.resource_type, i.resource_name, i.resource_satuan, 
           i.koefisien, i.resource_harga, i.resource_id
    FROM ahsp_items i
    JOIN ahsp_headers h ON h.id = i.ahsp_id
    WHERE h.kode LIKE 'CB.%' OR h.kode LIKE 'CS.%' OR h.kode LIKE 'PP.%' OR h.kode LIKE 'EL.%' OR h.kode LIKE 'ME.%'
  `);

  console.log(`Processing ${items.length} coefficient rows...`);

  let updated = 0;
  let notFound = 0;

  for (const item of items) {
    let table, typeName;
    if (item.resource_type === 'labor') {
      table = laborByName;
      typeName = 'labor';
    } else if (item.resource_type === 'material') {
      table = materialByName;
      typeName = 'material';
    } else if (item.resource_type === 'equipment') {
      table = equipmentByName;
      typeName = 'equipment';
    } else continue;

    const match = findBestMatch(item.resource_name, table);
    if (match) {
      const newHarga = parseFloat(match.harga);
      const oldHarga = parseFloat(item.resource_harga);
      const newJumlah = Math.round(parseFloat(item.koefisien) * newHarga * 100) / 100;
      
      if (Math.abs(newHarga - oldHarga) > 1) {
        await conn.query(
          'UPDATE ahsp_items SET resource_id = ?, resource_harga = ?, jumlah_harga = ? WHERE id = ?',
          [match.id, newHarga, newJumlah, item.id]
        );
        updated++;
      }
    } else {
      // Log unmatched items
      if (parseFloat(item.resource_harga) > 100000) {
        console.log(`  ⚠ No match: [${typeName}] "${item.resource_name}" @ ${item.resource_harga}`);
      }
      notFound++;
    }
  }

  console.log(`Updated ${updated} price entries, ${notFound} not found in master`);

  // Now recalculate all harga_satuan
  const [headers] = await conn.query(`
    SELECT id, kode FROM ahsp_headers 
    WHERE kode LIKE 'CB.%' OR kode LIKE 'CS.%' OR kode LIKE 'PP.%' OR kode LIKE 'EL.%' OR kode LIKE 'ME.%'
  `);

  let priceUpdated = 0;
  for (const h of headers) {
    const [sumResult] = await conn.query(
      'SELECT COALESCE(SUM(jumlah_harga), 0) as total FROM ahsp_items WHERE ahsp_id = ?',
      [h.id]
    );
    const total = Math.round(parseFloat(sumResult[0].total) * 100) / 100;
    await conn.query('UPDATE ahsp_headers SET harga_satuan = ? WHERE id = ?', [total, h.id]);
    priceUpdated++;
  }

  console.log(`Recalculated ${priceUpdated} harga_satuan values`);

  // Verify - show price distribution
  const [verify] = await conn.query(`
    SELECT 
      SUBSTRING(kode, 1, 2) as type,
      COUNT(*) as cnt,
      ROUND(MIN(harga_satuan)) as min_price,
      ROUND(AVG(harga_satuan)) as avg_price,
      ROUND(MAX(harga_satuan)) as max_price
    FROM ahsp_headers 
    WHERE kode LIKE 'CB.%' OR kode LIKE 'CS.%' OR kode LIKE 'PP.%' OR kode LIKE 'EL.%' OR kode LIKE 'ME.%'
    GROUP BY SUBSTRING(kode, 1, 2)
  `);
  console.log('\nPrice distribution after fix:');
  console.table(verify);

  // Show items still > 10M (potential issues)
  const [highPrice] = await conn.query(`
    SELECT kode, name, ROUND(harga_satuan) as harga FROM ahsp_headers 
    WHERE (kode LIKE 'CB.%' OR kode LIKE 'CS.%' OR kode LIKE 'PP.%' OR kode LIKE 'EL.%' OR kode LIKE 'ME.%')
    AND harga_satuan > 10000000
    ORDER BY harga_satuan DESC
  `);
  if (highPrice.length > 0) {
    console.log('\nItems still > 10M (may need review):');
    console.table(highPrice);
  } else {
    console.log('\nNo items > 10M - prices look reasonable!');
  }

  await conn.end();
}

main().catch(err => { console.error(err); process.exit(1); });
