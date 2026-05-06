/**
 * generate_sql_v2.js — Generate complete SQL with proper UOM codes
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

// UOM normalization map: display name => { code, label }
const UOM_MAP = {
  'm3': { code: 'M3', label: 'm3' },
  'm2': { code: 'M2', label: 'm2' },
  'm':  { code: 'M',  label: 'm' },
  'pcs': { code: 'PCS', label: 'Pcs' },
  'pc':  { code: 'PCS', label: 'Pcs' },
  'piece': { code: 'PCS', label: 'Pcs' },
  'pieces': { code: 'PCS', label: 'Pcs' },
  'kg':  { code: 'KG', label: 'Kg' },
  'kgs': { code: 'KG', label: 'Kg' },
  'kilogram': { code: 'KG', label: 'Kg' },
  'liter': { code: 'LTR', label: 'Liter' },
  'litre': { code: 'LTR', label: 'Liter' },
  'ltr':   { code: 'LTR', label: 'Liter' },
  'l':     { code: 'LTR', label: 'Liter' },
  'unit':  { code: 'UNIT', label: 'Unit' },
  'units': { code: 'UNIT', label: 'Unit' },
  'set':   { code: 'SET', label: 'Set' },
  'sets':  { code: 'SET', label: 'Set' },
  'lot':   { code: 'LOT', label: 'Lot' },
  'lots':  { code: 'LOT', label: 'Lot' },
  'box':   { code: 'BOX', label: 'Box' },
  'boxes': { code: 'BOX', label: 'Box' },
  'sak':   { code: 'SAK', label: 'Sak' },
  'bag':   { code: 'SAK', label: 'Sak' },
  'batang': { code: 'BTG', label: 'Batang' },
  'bar':    { code: 'BTG', label: 'Batang' },
  'lembar': { code: 'LMB', label: 'Lembar' },
  'sheet':  { code: 'LMB', label: 'Lembar' },
  'roll':   { code: 'ROLL', label: 'Roll' },
  'pack':   { code: 'PCK', label: 'Pack' },
  'pck':    { code: 'PCK', label: 'Pack' },
  'tabung': { code: 'TBG', label: 'Tabung' },
  'galon':  { code: 'GAL', label: 'Galon' },
  'lusin':  { code: 'LSN', label: 'Lusin' },
  'days':   { code: 'DAYS', label: 'Days' },
};

function getUOM(rawUnit) {
  const key = String(rawUnit || '').trim().toLowerCase();
  return UOM_MAP[key] || { code: key.toUpperCase().slice(0, 8), label: String(rawUnit || 'Pcs').trim() };
}

function esc(str) {
  return String(str || '').replace(/\\/g, '\\\\').replace(/'/g, "''");
}

const lines = [];
lines.push('-- Auto-generated from Price List.xlsx (v2 with UOM codes)');
lines.push('-- Date: ' + new Date().toISOString());
lines.push('SET NAMES utf8mb4;');
lines.push('');

// ── 1. UOM (with code) ──────────────────────────────────────────────────────
const uomSet = new Map(); // code -> label
data.forEach(r => {
  const uom = getUOM(r[3]);
  uomSet.set(uom.code, uom.label);
});

lines.push('-- ===== 1. UOM =====');
for (const [code, label] of uomSet.entries()) {
  lines.push(`INSERT IGNORE INTO uom (code, name, active) VALUES ('${esc(code)}', '${esc(label)}', 1);`);
}
lines.push('');

// ── 2. Vendors ──────────────────────────────────────────────────────────────
const uniqueVendors = [...new Set(
  data.map(r => String(r[5] || '').trim()).filter(Boolean)
)];
lines.push('-- ===== 2. VENDORS =====');
uniqueVendors.forEach((v, i) => {
  const code = v.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 8) +
               String(1000 + i);
  lines.push(`INSERT IGNORE INTO vendors (code, name, is_active) VALUES ('${esc(code)}', '${esc(v)}', 1);`);
});
lines.push('');

// ── 3. Products ─────────────────────────────────────────────────────────────
lines.push('-- ===== 3. PRODUCTS =====');
data.forEach((row, i) => {
  const name  = String(row[0] || '').trim();
  const spec  = String(row[1] || '').trim();
  const price = Number(row[4]) || 0;
  if (!name) return;

  const sku    = generateSKU(name, i + 1);
  const uom    = getUOM(row[3]);
  const descV  = spec ? `'${esc(spec)}'` : 'NULL';
  const uomSub = `(SELECT id FROM uom WHERE code = '${esc(uom.code)}' LIMIT 1)`;

  lines.push(`INSERT INTO products (sku, name, description, unit_of_measure_id, standard_cost, active)`);
  lines.push(`  SELECT '${esc(sku)}', '${esc(name)}', ${descV}, ${uomSub}, ${price}, 1`);
  lines.push(`  WHERE NOT EXISTS (SELECT 1 FROM products p2 WHERE p2.name = '${esc(name)}');`);
  lines.push(`UPDATE products SET standard_cost = ${price}, description = ${descV},`);
  lines.push(`  unit_of_measure_id = ${uomSub}`);
  lines.push(`  WHERE name = '${esc(name)}';`);
  lines.push('');
});

lines.push("SELECT CONCAT('Total products: ', COUNT(1)) as import_result FROM products;");
lines.push("SELECT CONCAT('With UOM: ', COUNT(1)) as uom_linked FROM products WHERE unit_of_measure_id IS NOT NULL;");
lines.push("SELECT CONCAT('Without UOM: ', COUNT(1)) as uom_missing FROM products WHERE unit_of_measure_id IS NULL;");

const outFile = path.join(__dirname, 'import_pricelist_v2.sql');
fs.writeFileSync(outFile, lines.join('\n'), 'utf8');

const sizeMB = (fs.statSync(outFile).size / 1024 / 1024).toFixed(2);
console.log(`✅ SQL v2 generated: import_pricelist_v2.sql`);
console.log(`   Size: ${sizeMB} MB | Lines: ${lines.length}`);
console.log(`   Products: ${data.length} | Vendors: ${uniqueVendors.length} | UOMs: ${uomSet.size}`);
