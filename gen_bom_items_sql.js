/**
 * Sync BOM items to products table
 * - Creates missing Finished Goods from bom_headers
 * - Creates missing Raw Materials/Components from bom_details  
 * - Links bom_headers.product_id and bom_details.raw_material_id
 */
const fs = require('fs');

// Category mapping based on JBox item_code prefix
// 31xxx = Finished Goods (pesticides etc)
// 32xxx = Raw Material / Chemical
// 33xxx = Packaging Materials
// 54xxx = Others
function getCategoryId(itemCode, description) {
  if (!itemCode) return 13; // Chemical default
  const prefix = itemCode.substring(0, 2);
  const desc = (description || '').toLowerCase();
  
  if (prefix === '31') return 7;   // Finished Goods
  if (prefix === '32') {
    if (desc.includes('solvent') || desc.includes('mcb') || desc.includes('benzene')) return 23; // Solvent
    return 13; // Chemical
  }
  if (prefix === '33') {
    if (desc.includes('label') || desc.includes('sticker')) return 20; // Label sticker
    if (desc.includes('karton') || desc.includes('carton') || desc.includes('box')) return 21; // Karton box
    if (desc.includes('botol') || desc.includes('bottle') || desc.includes('jerry')) return 22; // Botol PE
    return 14; // Packaging
  }
  if (prefix === '10' || prefix === '54') return 30; // OTHER
  return 13; // Chemical default
}

function getProductTypeId(itemCode) {
  if (!itemCode) return 17; // Raw Material
  const prefix = itemCode.substring(0, 2);
  if (prefix === '31') return 19; // Finished Goods
  if (prefix === '33') return 18; // Packaging Material
  return 17; // Raw Material
}

const esc = (s) => {
  if (s === null || s === undefined) return 'NULL';
  return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '') + "'";
};

console.log('📂 Loading bom_data.json...');
const boms = JSON.parse(fs.readFileSync('bom_data.json', 'utf8'));
console.log(`   Loaded ${boms.length} BOMs\n`);

// Collect all unique items
const fgItems = new Map(); // bom_code -> {name, unit}
const rmItems = new Map(); // item_code -> {description, unit}

for (const bom of boms) {
  // FG from header
  if (bom.bom_code) {
    if (!fgItems.has(bom.bom_code)) {
      fgItems.set(bom.bom_code, { name: bom.description, unit: bom.unit });
    }
  }
  // RM from components
  if (bom.components) {
    for (const comp of bom.components) {
      if (comp.item_code && !rmItems.has(comp.item_code)) {
        rmItems.set(comp.item_code, { description: comp.description, unit: comp.unit });
      }
    }
  }
}

console.log(`📊 Unique FG items: ${fgItems.size}`);
console.log(`📊 Unique RM items: ${rmItems.size}\n`);

let sql = '';
sql += 'SET FOREIGN_KEY_CHECKS=0;\n';
sql += 'START TRANSACTION;\n\n';

// 1. Insert FG products (from BOM headers)
sql += '-- ===== FINISHED GOODS (from BOM headers) =====\n';
let fgCount = 0;
for (const [sku, info] of fgItems) {
  const catId = getCategoryId(sku, info.name);
  const typeId = getProductTypeId(sku);
  const name = info.name || sku;
  
  sql += `INSERT IGNORE INTO products (sku, name, category_id, product_type_id, active) VALUES (${esc(sku)}, ${esc(name)}, ${catId}, ${typeId}, 1);\n`;
  fgCount++;
}

sql += '\n-- ===== RAW MATERIALS / COMPONENTS (from BOM details) =====\n';
let rmCount = 0;
for (const [sku, info] of rmItems) {
  // Skip if this was already added as FG
  if (fgItems.has(sku)) continue;
  
  const catId = getCategoryId(sku, info.description);
  const typeId = getProductTypeId(sku);
  const name = info.description || sku;
  
  sql += `INSERT IGNORE INTO products (sku, name, category_id, product_type_id, active) VALUES (${esc(sku)}, ${esc(name)}, ${catId}, ${typeId}, 1);\n`;
  rmCount++;
}

// 2. Link bom_headers.product_id to newly created products
sql += '\n-- ===== LINK bom_headers.product_id =====\n';
sql += `UPDATE bom_headers bh JOIN products p ON bh.bom_code = p.sku SET bh.product_id = p.id WHERE bh.product_id IS NULL AND bh.bom_code IS NOT NULL;\n`;

// 3. Link bom_details.raw_material_id to newly created products
sql += '\n-- ===== LINK bom_details.raw_material_id =====\n';
sql += `UPDATE bom_details bd JOIN products p ON bd.item_code = p.sku SET bd.raw_material_id = p.id WHERE (bd.raw_material_id IS NULL OR bd.raw_material_id = 0) AND bd.item_code IS NOT NULL AND bd.item_code != '';\n`;

sql += '\nCOMMIT;\n';
sql += 'SET FOREIGN_KEY_CHECKS=1;\n';

// Summary queries
sql += '\n-- ===== VERIFICATION =====\n';
sql += 'SELECT COUNT(*) as total_products FROM products;\n';
sql += "SELECT COUNT(*) as jbox_fg FROM products WHERE sku REGEXP '^[0-9]' AND product_type_id = 19;\n";
sql += "SELECT COUNT(*) as jbox_rm FROM products WHERE sku REGEXP '^[0-9]' AND product_type_id IN (17,18);\n";
sql += 'SELECT COUNT(*) as linked_headers FROM bom_headers WHERE product_id IS NOT NULL AND source = \'JBOX\';\n';
sql += 'SELECT COUNT(*) as linked_details FROM bom_details WHERE raw_material_id > 0;\n';

fs.writeFileSync('bom_items_sync.sql', sql);
console.log(`✅ Generated bom_items_sync.sql`);
console.log(`   FG products: ${fgCount}`);
console.log(`   RM products: ${rmCount}`);
console.log(`   Total new: ${fgCount + rmCount}`);
console.log(`   File size: ${(Buffer.byteLength(sql) / 1024).toFixed(1)} KB`);
