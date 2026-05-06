/**
 * import_pricelist.js
 * Import Price List.xlsx -> products + vendors + uom tables
 * Run: node backend/scripts/import_pricelist.js
 */

const XLSX   = require('xlsx');
const mysql  = require('mysql2/promise');
const path   = require('path');
const fs     = require('fs');

// ─── Config ───────────────────────────────────────────────────────────────────
const EXCEL_PATH = path.join(__dirname, '../../Price List.xlsx');
const DB_CONFIG  = {
  host    : '76.13.22.155',
  port    : 3306,
  user    : 'erp_user',
  password: 'ErpSecure2024!',
  database: 'erp_manufacturing',
  multipleStatements: true,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function generateSKU(name, index) {
  const clean = String(name || '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 20)
    .replace(/-+$/, '');
  const pad = String(index).padStart(4, '0');
  return `ITM-${clean}-${pad}`;
}

function normalizeUnit(unit) {
  if (!unit) return 'Pcs';
  const u = String(unit).trim();
  // Normalize common variations
  const map = {
    'pcs': 'Pcs', 'pc': 'Pcs', 'piece': 'Pcs', 'pieces': 'Pcs',
    'kg': 'Kg', 'kilogram': 'Kg', 'kgs': 'Kg',
    'm': 'm', 'meter': 'm', 'metre': 'm',
    'm2': 'm²', 'm²': 'm²', 'sqm': 'm²',
    'm3': 'm³', 'm³': 'm³', 'cbm': 'm³',
    'ltr': 'Liter', 'liter': 'Liter', 'litre': 'Liter', 'l': 'Liter',
    'set': 'Set', 'sets': 'Set',
    'unit': 'Unit', 'units': 'Unit',
    'lot': 'Lot', 'lots': 'Lot',
    'box': 'Box', 'boxes': 'Box',
    'sak': 'Sak', 'bag': 'Sak',
    'batang': 'Batang', 'bar': 'Batang',
    'lembar': 'Lembar', 'sheet': 'Lembar',
    'roll': 'Roll',
    'pack': 'Pack', 'pck': 'Pack',
    'tabung': 'Tabung',
    'galon': 'Galon',
    'lusin': 'Lusin',
    'days': 'Days',
  };
  return map[u.toLowerCase()] || u;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('📂 Reading Excel file:', EXCEL_PATH);
  const wb   = XLSX.readFile(EXCEL_PATH);
  const ws   = wb.Sheets['LOG'];
  if (!ws) { console.error('❌ Sheet "LOG" not found'); process.exit(1); }

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }).slice(1); // skip header
  const data = rows.filter(r => r[0] && String(r[0]).trim()); // skip empty name rows
  console.log(`📊 Found ${data.length} data rows`);

  console.log('🔌 Connecting to database...');
  const conn = await mysql.createConnection(DB_CONFIG);
  console.log('✅ Connected!\n');

  // ── 1. Build UOM map ────────────────────────────────────────────────────────
  console.log('── Step 1: Syncing UOM table...');
  const existingUoms = await conn.query('SELECT id, name FROM uom');
  const uomMap = {}; // name -> id
  for (const row of existingUoms[0]) {
    uomMap[row.name.toLowerCase()] = row.id;
  }

  const uniqueUnits = [...new Set(data.map(r => normalizeUnit(r[3])))];
  for (const unit of uniqueUnits) {
    const key = unit.toLowerCase();
    if (!uomMap[key]) {
      const [res] = await conn.query('INSERT INTO uom (name) VALUES (?)', [unit]);
      uomMap[key] = res.insertId;
      console.log(`  + UOM: ${unit} (id=${res.insertId})`);
    }
  }
  console.log(`  ✅ UOM done. ${Object.keys(uomMap).length} total units\n`);

  // ── 2. Build Vendor map ─────────────────────────────────────────────────────
  console.log('── Step 2: Syncing vendors...');
  const existingVendors = await conn.query('SELECT id, name FROM vendors');
  const vendorMap = {}; // name.lower -> id
  for (const v of existingVendors[0]) {
    vendorMap[v.name.toLowerCase().trim()] = v.id;
  }

  const uniqueVendors = [...new Set(data.map(r => String(r[5] || '').trim()).filter(Boolean))];
  let vendorAdded = 0;
  for (const vName of uniqueVendors) {
    const key = vName.toLowerCase();
    if (!vendorMap[key]) {
      // Generate code from name
      const code = vName.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 10) +
                   '-' + Math.floor(Math.random() * 9000 + 1000);
      const [res] = await conn.query(
        'INSERT INTO vendors (code, name, is_active) VALUES (?, ?, 1)',
        [code, vName]
      );
      vendorMap[key] = res.insertId;
      vendorAdded++;
    }
  }
  console.log(`  ✅ Vendors done. ${vendorAdded} new vendors added, ${Object.keys(vendorMap).length} total\n`);

  // ── 3. Import products ──────────────────────────────────────────────────────
  console.log('── Step 3: Importing products...');

  let inserted = 0;
  let skipped  = 0;
  let updated  = 0;
  const errors  = [];

  for (let i = 0; i < data.length; i++) {
    const row   = data[i];
    const name  = String(row[0] || '').trim();
    const spec  = String(row[1] || '').trim();
    const unit  = normalizeUnit(row[3]);
    const price = Number(row[4]) || 0;

    if (!name) { skipped++; continue; }

    const sku       = generateSKU(name, i + 1);
    const uomId     = uomMap[unit.toLowerCase()] || null;
    const desc      = spec ? `${spec}` : null;

    try {
      // Check if product with same name already exists
      const [existing] = await conn.query(
        'SELECT id FROM products WHERE name = ? LIMIT 1',
        [name]
      );

      if (existing.length > 0) {
        // Update price only
        await conn.query(
          'UPDATE products SET standard_cost = ?, description = ?, unit_of_measure_id = ?, updated_at = NOW() WHERE id = ?',
          [price, desc, uomId, existing[0].id]
        );
        updated++;
      } else {
        // Insert new
        await conn.query(
          `INSERT INTO products (sku, name, description, unit_of_measure_id, standard_cost, active)
           VALUES (?, ?, ?, ?, ?, 1)`,
          [sku, name, desc, uomId, price]
        );
        inserted++;
      }
    } catch (err) {
      errors.push({ row: i + 2, name, error: err.message });
    }

    if ((i + 1) % 100 === 0) {
      process.stdout.write(`  Progress: ${i + 1}/${data.length} rows...\r`);
    }
  }

  console.log(`\n  ✅ Products done!`);
  console.log(`     Inserted : ${inserted}`);
  console.log(`     Updated  : ${updated}`);
  console.log(`     Skipped  : ${skipped}`);
  console.log(`     Errors   : ${errors.length}`);
  if (errors.length > 0) {
    console.log('\n  ❌ Errors:');
    errors.slice(0, 10).forEach(e => console.log(`    Row ${e.row}: ${e.name} → ${e.error}`));
  }

  // ── 4. Final count ──────────────────────────────────────────────────────────
  const [countRes] = await conn.query('SELECT COUNT(*) as total FROM products');
  console.log(`\n🎯 Final total in DB: ${countRes[0].total} products`);

  await conn.end();
  console.log('\n✅ Import complete!');
}

main().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
