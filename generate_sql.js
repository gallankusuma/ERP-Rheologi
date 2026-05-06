/**
 * generate_sql.js — Generate SQL import file from Price List.xlsx
 * Run: node generate_sql.js
 */
const XLSX = require('xlsx');
const fs   = require('fs');
const path = require('path');

const wb   = XLSX.readFile(path.join(__dirname, 'Price List.xlsx'));
const ws   = wb.Sheets['LOG'];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }).slice(1);
const data = rows.filter(r => r[0] && String(r[0]).trim());

function generateSKU(name, index) {
  const clean = String(name || '').toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 20)
    .replace(/-+$/, '');
  return 'ITM-' + clean + '-' + String(index).padStart(4, '0');
}

function normalizeUnit(unit) {
  if (!unit) return 'Pcs';
  const u = String(unit).trim();
  const map = {
    'pcs':'Pcs','pc':'Pcs','piece':'Pcs','pieces':'Pcs',
    'kg':'Kg','kilogram':'Kg','kgs':'Kg',
    'm':'m','meter':'m','metre':'m',
    'm2':'m2','sqm':'m2',
    'm3':'m3','cbm':'m3',
    'ltr':'Liter','liter':'Liter','litre':'Liter',
    'set':'Set','sets':'Set',
    'unit':'Unit','units':'Unit',
    'lot':'Lot','lots':'Lot',
    'box':'Box','boxes':'Box',
    'sak':'Sak','bag':'Sak',
    'batang':'Batang','bar':'Batang',
    'lembar':'Lembar','sheet':'Lembar',
    'roll':'Roll',
    'pack':'Pack','pck':'Pack',
    'tabung':'Tabung','galon':'Galon','lusin':'Lusin','days':'Days',
  };
  return map[u.toLowerCase()] || u;
}

function esc(str) {
  return String(str || '').replace(/\\/g, '\\\\').replace(/'/g, "''");
}

const lines = [];
lines.push('-- Auto-generated from Price List.xlsx');
lines.push('-- Date: ' + new Date().toISOString());
lines.push('SET NAMES utf8mb4;');
lines.push('');

// UOM
const uniqueUnits = [...new Set(data.map(r => normalizeUnit(r[3])))];
lines.push('-- ===== 1. UOM =====');
for (const u of uniqueUnits) {
  lines.push(`INSERT IGNORE INTO uom (name) VALUES ('${esc(u)}');`);
}
lines.push('');

// Vendors
const uniqueVendors = [...new Set(
  data.map(r => String(r[5] || '').trim()).filter(Boolean)
)];
lines.push('-- ===== 2. VENDORS =====');
uniqueVendors.forEach((v, i) => {
  const code = v.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 8) + (1000 + i);
  lines.push(`INSERT IGNORE INTO vendors (code, name, is_active) VALUES ('${esc(code)}', '${esc(v)}', 1);`);
});
lines.push('');

// Products (upsert pattern)
lines.push('-- ===== 3. PRODUCTS =====');
data.forEach((row, i) => {
  const name  = String(row[0] || '').trim();
  const spec  = String(row[1] || '').trim();
  const unit  = normalizeUnit(row[3]);
  const price = Number(row[4]) || 0;
  if (!name) return;

  const sku     = generateSKU(name, i + 1);
  const descVal = spec ? `'${esc(spec)}'` : 'NULL';
  const uomSub  = `(SELECT id FROM uom WHERE name = '${esc(unit)}' LIMIT 1)`;

  // Insert only if name not exists
  lines.push(`INSERT INTO products (sku, name, description, unit_of_measure_id, standard_cost, active)`);
  lines.push(`  SELECT '${esc(sku)}', '${esc(name)}', ${descVal}, ${uomSub}, ${price}, 1`);
  lines.push(`  WHERE NOT EXISTS (SELECT 1 FROM products p2 WHERE p2.name = '${esc(name)}');`);

  // Always update price + uom
  lines.push(`UPDATE products SET standard_cost = ${price}, description = ${descVal},`);
  lines.push(`  unit_of_measure_id = ${uomSub}`);
  lines.push(`  WHERE name = '${esc(name)}';`);
  lines.push('');
});

lines.push("SELECT CONCAT('Total products: ', COUNT(1)) as import_result FROM products;");

const outFile = path.join(__dirname, 'import_pricelist.sql');
fs.writeFileSync(outFile, lines.join('\n'), 'utf8');

const sizeMB = (fs.statSync(outFile).size / 1024 / 1024).toFixed(2);
console.log(`✅ SQL file generated: import_pricelist.sql`);
console.log(`   Size: ${sizeMB} MB`);
console.log(`   Lines: ${lines.length}`);
console.log(`   Products: ${data.length}`);
console.log(`   Vendors: ${uniqueVendors.length}`);
console.log(`   UOMs: ${uniqueUnits.length}`);
