/**
 * Generate SQL import file from bom_data.json
 * Then we pipe it via SSH to the remote MySQL server
 */
const fs = require('fs');

console.log('📂 Loading bom_data.json...');
const boms = JSON.parse(fs.readFileSync('bom_data.json', 'utf8'));
console.log(`   Loaded ${boms.length} BOMs\n`);

const esc = (s) => {
  if (s === null || s === undefined) return 'NULL';
  return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '') + "'";
};

let sql = '';
sql += 'SET FOREIGN_KEY_CHECKS=0;\n';
sql += 'START TRANSACTION;\n\n';

let headerCount = 0;
let detailCount = 0;

for (const bom of boms) {
  const qtyClean = (bom.qty || '').replace(/,/g, '') || '0';
  
  sql += `INSERT IGNORE INTO bom_headers (jbox_id, bom_code, product_name, qty, unit, version, status, process_type, production_line, notes, source) VALUES (`;
  sql += `${bom.id}, ${esc(bom.bom_code)}, ${esc(bom.description)}, ${esc(qtyClean)}, ${esc(bom.unit)}, ${bom.version || 1}, 'ACTIVE', ${esc(bom.process)}, ${esc(bom.line)}, ${esc(bom.remark)}, 'JBOX');\n`;
  headerCount++;
  
  if (bom.components && bom.components.length > 0) {
    sql += `SET @bom_hid = (SELECT id FROM bom_headers WHERE jbox_id = ${bom.id});\n`;
    
    for (const comp of bom.components) {
      const compQty = parseFloat((comp.qty || '0').replace(/,/g, '')) || 0;
      const pctTol = parseFloat(comp.pct_tolerance) || 0;
      const tolVal = parseFloat(comp.tolerance_value) || 0;
      
      sql += `INSERT INTO bom_details (bom_header_id, raw_material_id, item_code, item_description, quantity, unit, sequence, use_tolerance, pct_tolerance, tolerance_value, remark) VALUES (`;
      sql += `@bom_hid, 0, ${esc(comp.item_code)}, ${esc(comp.description)}, ${compQty}, ${esc(comp.unit)}, ${parseInt(comp.no) || 0}, ${esc(comp.use_tolerance)}, ${pctTol}, ${tolVal}, ${esc(comp.remark)});\n`;
      detailCount++;
    }
  }
  sql += '\n';
}

sql += 'COMMIT;\n';
sql += 'SET FOREIGN_KEY_CHECKS=1;\n';

fs.writeFileSync('bom_import.sql', sql);
console.log(`✅ Generated bom_import.sql`);
console.log(`   Headers: ${headerCount}`);
console.log(`   Details: ${detailCount}`);
console.log(`   File size: ${(Buffer.byteLength(sql) / 1024 / 1024).toFixed(2)} MB`);
