const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const wb = XLSX.readFile(path.join(__dirname, 'Master Data.xlsx'));
const itemData = XLSX.utils.sheet_to_json(wb.Sheets['Item Code'], { header: 1 });

const typeMap = {
  'RM': { code: 'RM', name: 'Raw Material', desc: 'Raw materials and ingredients' },
  'PM': { code: 'PM', name: 'Packaging Material', desc: 'Packaging materials and containers' },
  'FG': { code: 'FG', name: 'Finished Goods', desc: 'Ready-to-sell finished products' },
  'SR': { code: 'SR', name: 'Spare Part', desc: 'Spare parts and components' },
  'SV': { code: 'SV', name: 'Service Products', desc: 'Service-related products' },
  'OS': { code: 'OS', name: 'Others', desc: 'Miscellaneous items' },
};

const categoryMap = {
  'Main component': 'Raw Material',
  'Thickener': 'Chemical',
  'Solvent': 'Chemical',
  'Preservative': 'Chemical',
  'Desinfectant agent': 'Chemical',
  'Surfactant': 'Chemical',
  'Cleaning agent of pellicle': 'Chemical',
  'Packaging material': 'Packaging',
  'Finish Good': 'Finished Product',
};

const unitSet = new Set();
const catSet = new Set();

const items = [];
for (let i = 26; i < itemData.length; i++) {
  const row = itemData[i];
  if (!row || !row[0] || typeof row[0] !== 'string' || row[0] === 'Item Code') continue;
  const sku = String(row[0]).trim();
  const type = String(row[1] || '').trim();
  const name = String(row[2] || '').trim();
  const func = String(row[3] || '').trim();
  const unit = row[7] ? String(row[7]).trim().toLowerCase() : 'pcs';
  if (!sku || !name) continue;
  unitSet.add(unit);
  const cat = categoryMap[func] || func || 'Uncategorized';
  catSet.add(cat);
  items.push({ sku, type, name, func, unit, category: cat });
}

function parseBOM(sheetName, bomName) {
  const data = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });
  let bomId = '';
  const details = [];
  for (let i = 4; i < data.length; i++) { // skip header rows
    const row = data[i];
    if (!row || !row[2] || typeof row[2] !== 'string' || row[2] === 'RM ID') continue;
    if (row[0]) bomId = String(row[0]).trim();
    details.push({
      rm_id: String(row[2]).trim(),
      material_name: String(row[3] || '').trim(),
      func: String(row[4] || '').trim(),
      unit: String(row[5] || 'kg').trim().toLowerCase(),
      quantity: Number(row[6]) || 0,
    });
  }
  return { bomId, bomName, details };
}

const boms = [
  parseBOM('BOM Detail Cylo ', 'Cylo @200 ltr'),
  parseBOM('BOM Detail Cylo Bind', 'Cylo Bind @2.5 gal'),
  parseBOM('BOM Detail Cylo Plus', 'Cylo Plus @200 ltr'),
];

let sql = 'SET FOREIGN_KEY_CHECKS=0;\n\n';
sql += '-- Master Data Injection from Master Data.xlsx\n';
sql += '-- Generated: ' + new Date().toISOString() + '\n\n';

// 1. Product Types
sql += '-- 1. PRODUCT TYPES\nDELETE FROM product_types;\n';
for (const info of Object.values(typeMap)) {
  sql += `INSERT INTO product_types (code, name, description, active) VALUES ('${info.code}', '${info.name}', '${info.desc}', 1);\n`;
}

// 2. UoM
sql += '\n-- 2. UNITS OF MEASURE\n';
const uomMap = { 'kg': ['KG','Kilogram'], 'l': ['L','Liter'], 'pcs': ['PCS','Pieces'] };
for (const u of unitSet) {
  const [code, name] = uomMap[u] || [u.toUpperCase(), u];
  sql += `INSERT IGNORE INTO uom (code, name, active) VALUES ('${code}', '${name}', 1);\n`;
}

// 3. Categories
sql += '\n-- 3. CATEGORIES\n';
for (const cat of catSet) {
  sql += `INSERT IGNORE INTO categories (name, description, active) VALUES ('${cat}', '${cat}', 1);\n`;
}

// 4. Products
sql += '\n-- 4. PRODUCTS (62 Master Items)\nDELETE FROM products;\n';
for (const item of items) {
  const n = item.name.replace(/'/g, "''");
  const f = item.func.replace(/'/g, "''");
  const c = item.category.replace(/'/g, "''");
  sql += `INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT '${item.sku}', '${n}', '${f}',
    (SELECT id FROM categories WHERE name = '${c}' LIMIT 1),
    (SELECT id FROM product_types WHERE code = '${item.type}' LIMIT 1),
    (SELECT id FROM uom WHERE code = '${(uomMap[item.unit] || [item.unit.toUpperCase()])[0]}' LIMIT 1),
    0, 0, 1;\n`;
}

// 5. BOMs (using correct schema: bom_headers.product_name, bom_details.bom_header_id/raw_material_id/unit_of_measure_id)
sql += '\n-- 5. BILL OF MATERIALS\nDELETE FROM bom_details;\nDELETE FROM bom_headers;\n';
for (const bom of boms) {
  const bn = bom.bomName.replace(/'/g, "''");
  sql += `\n-- BOM: ${bom.bomName}\n`;
  sql += `INSERT INTO bom_headers (product_name, product_id, version, status, notes)
  SELECT '${bn}',
    (SELECT id FROM products WHERE sku = '${bom.bomId}' LIMIT 1),
    1, 'ACTIVE', 'BOM ${bn}';\n`;
  sql += `SET @bom_id = LAST_INSERT_ID();\n`;
  
  bom.details.forEach((d, idx) => {
    const mn = d.material_name.replace(/'/g, "''");
    const unitCode = (uomMap[d.unit] || [d.unit.toUpperCase()])[0];
    sql += `INSERT INTO bom_details (bom_header_id, raw_material_id, quantity, unit_of_measure_id, sequence)
  SELECT @bom_id,
    (SELECT id FROM products WHERE sku = '${d.rm_id}' LIMIT 1),
    ${d.quantity},
    (SELECT id FROM uom WHERE code = '${unitCode}' LIMIT 1),
    ${idx + 1};\n`;
  });
}

sql += '\nSET FOREIGN_KEY_CHECKS=1;\n\n';
sql += "-- VERIFY:\nSELECT 'product_types' as tbl, COUNT(*) as cnt FROM product_types\n";
sql += "UNION SELECT 'categories', COUNT(*) FROM categories\n";
sql += "UNION SELECT 'uom', COUNT(*) FROM uom\n";
sql += "UNION SELECT 'products', COUNT(*) FROM products\n";
sql += "UNION SELECT 'bom_headers', COUNT(*) FROM bom_headers\n";
sql += "UNION SELECT 'bom_details', COUNT(*) FROM bom_details;\n";

fs.writeFileSync(path.join(__dirname, 'backend', 'inject_master_data.sql'), sql);
console.log('✅ SQL regenerated (schema-compatible)');
console.log(`   Items: ${items.length}, BOMs: ${boms.length}, Details: ${boms.reduce((s,b)=>s+b.details.length,0)}`);
