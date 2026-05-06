const mysql = require('mysql2/promise');

async function checkImportedData() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'erp_manufacturing'
  });

  try {
    // Get last 5 materials with their vendors
    const [materials] = await connection.query(`
      SELECT m.code, m.name, m.vendor_id, v.name as vendor_name, m.created_at
      FROM master_materials m
      LEFT JOIN vendors v ON m.vendor_id = v.id
      ORDER BY m.created_at DESC
      LIMIT 5
    `);

    console.log('\n📊 Last 5 imported materials:');
    console.log('='.repeat(80));
    materials.forEach(m => {
      console.log(`Code: ${m.code}`);
      console.log(`Name: ${m.name}`);
      console.log(`Vendor ID: ${m.vendor_id || '(null)'}`);
      console.log(`Vendor Name: ${m.vendor_name || '(none)'}`);
      console.log(`Created: ${m.created_at}`);
      console.log('-'.repeat(80));
    });

    // Check if any vendors were auto-created
    const [vendors] = await connection.query(`
      SELECT id, code, name, created_at
      FROM vendors
      ORDER BY created_at DESC
      LIMIT 5
    `);

    console.log('\n📊 Last 5 vendors:');
    console.log('='.repeat(80));
    vendors.forEach(v => {
      console.log(`ID: ${v.id} | Code: ${v.code} | Name: ${v.name} | Created: ${v.created_at}`);
    });

    // Count materials with vendors
    const [counts] = await connection.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN vendor_id IS NOT NULL THEN 1 ELSE 0 END) as with_vendor
      FROM master_materials
    `);

    console.log('\n📊 Overall statistics:');
    console.log('='.repeat(80));
    console.log(`Total materials: ${counts[0].total}`);
    console.log(`Materials with vendor: ${counts[0].with_vendor}`);
    console.log(`Materials without vendor: ${counts[0].total - counts[0].with_vendor}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkImportedData();
