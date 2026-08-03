/**
 * Import scraped BOM data into ERP database
 * Reads bom_data.json → inserts into bom_headers + bom_details
 */
const mysql = require('mysql2/promise');
const fs = require('fs');

const DB_CONFIG = {
  host: '76.13.22.155',
  user: 'erp_user',
  password: 'ErpSecure2024!',
  database: 'erp_rheologi',
  connectTimeout: 10000,
};

async function main() {
  console.log('📂 Loading bom_data.json...');
  const raw = fs.readFileSync('bom_data.json', 'utf8');
  const boms = JSON.parse(raw);
  console.log(`   Loaded ${boms.length} BOMs\n`);

  console.log('🔌 Connecting to database...');
  const conn = await mysql.createConnection(DB_CONFIG);
  console.log('✅ Connected\n');

  let insertedHeaders = 0;
  let skippedHeaders = 0;
  let insertedDetails = 0;
  let count = 0;

  for (const bom of boms) {
    count++;
    try {
      // Check if jbox_id already exists
      const [existing] = await conn.execute(
        'SELECT id FROM bom_headers WHERE jbox_id = ?', [bom.id]
      );

      let headerId;
      if (existing.length > 0) {
        headerId = existing[0].id;
        skippedHeaders++;
      } else {
        // Parse qty — remove commas
        const qtyClean = (bom.qty || '').replace(/,/g, '');

        const [result] = await conn.execute(
          `INSERT INTO bom_headers 
           (jbox_id, bom_code, product_name, qty, unit, version, status, process_type, production_line, notes, source)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'JBOX')`,
          [
            bom.id,
            bom.bom_code || null,
            bom.description || bom.bom_code || '',
            qtyClean || null,
            bom.unit || null,
            bom.version || 1,
            'ACTIVE',
            bom.process || null,
            bom.line || null,
            bom.remark || null,
          ]
        );
        headerId = result.insertId;
        insertedHeaders++;
      }

      // Insert components (skip if header already existed — avoid duplicates)
      if (existing.length === 0 && bom.components && bom.components.length > 0) {
        for (const comp of bom.components) {
          const compQty = parseFloat((comp.qty || '0').replace(/,/g, '')) || 0;
          const pctTol = parseFloat(comp.pct_tolerance) || 0;
          const tolVal = parseFloat(comp.tolerance_value) || 0;

          await conn.execute(
            `INSERT INTO bom_details 
             (bom_header_id, raw_material_id, item_code, item_description, quantity, unit, sequence, use_tolerance, pct_tolerance, tolerance_value, remark)
             VALUES (?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              headerId,
              comp.item_code || '',
              comp.description || '',
              compQty,
              comp.unit || null,
              parseInt(comp.no) || 0,
              comp.use_tolerance || 'No',
              pctTol,
              tolVal,
              comp.remark || null,
            ]
          );
          insertedDetails++;
        }
      }

      if (count <= 5 || count % 200 === 0 || count === boms.length) {
        console.log(`[${count}/${boms.length}] ${bom.bom_code} — ${(bom.description || '').substring(0, 50)} (${bom.components?.length || 0} comps)`);
      }
    } catch (e) {
      console.error(`[${count}] BOM ${bom.id} ERROR: ${e.message}`);
    }
  }

  await conn.end();

  console.log(`\n📊 Import Summary:`);
  console.log(`   Headers inserted: ${insertedHeaders}`);
  console.log(`   Headers skipped (already exist): ${skippedHeaders}`);
  console.log(`   Details inserted: ${insertedDetails}`);
  console.log(`\n✅ Done!`);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
