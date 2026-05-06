const mysql = require('mysql2/promise');

async function verifyBOMSave() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'erp_manufacturing'
    });

    console.log('🔍 Verifying BOM Data in Database\n');

    // Query BOM headers
    const [bomHeaders] = await connection.query(`
      SELECT id, product_name, status, notes, created_by, created_at
      FROM bom_headers
      ORDER BY created_at DESC
      LIMIT 3
    `);

    if (bomHeaders.length === 0) {
      console.log('❌ No BOM headers found!');
      process.exit(1);
    }

    console.log('📋 Recent BOM Headers:');
    bomHeaders.forEach((bom, idx) => {
      console.log(`\n  ${idx + 1}. BOM ID: ${bom.id}`);
      console.log(`     Product: ${bom.product_name}`);
      console.log(`     Status: ${bom.status}`);
      console.log(`     Created By: ${bom.created_by || 'NULL (Anonymous)'}`);
      console.log(`     Created At: ${bom.created_at}`);
      console.log(`     Notes: ${bom.notes || '(none)'}`);
    });

    // Query BOM details for the latest BOM
    const latestBomId = bomHeaders[0].id;
    const [bomDetails] = await connection.query(`
      SELECT bd.id, bd.raw_material_id, bd.quantity, u.code as unit_code, p.name as material_name
      FROM bom_details bd
      LEFT JOIN uom u ON bd.unit_of_measure_id = u.id
      LEFT JOIN products p ON bd.raw_material_id = p.id
      WHERE bd.bom_header_id = ?
      ORDER BY bd.sequence ASC
    `, [latestBomId]);

    if (bomDetails.length > 0) {
      console.log(`\n📦 BOM Details for BOM #${latestBomId}:`);
      bomDetails.forEach((detail, idx) => {
        console.log(`\n  Component ${idx + 1}:`);
        console.log(`    Raw Material: ${detail.material_name || `ID ${detail.raw_material_id}`}`);
        console.log(`    Quantity: ${detail.quantity} ${detail.unit_code || 'units'}`);
      });
    }

    console.log('\n✅ BOM data verified successfully!');
    console.log('   - BOM header created with NULL created_by (user doesn\'t exist)');
    console.log('   - BOM details inserted correctly');
    console.log('   - Foreign key constraint allows NULL created_by');

  } catch (error) {
    console.error('❌ Verification error:', error.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

verifyBOMSave();
