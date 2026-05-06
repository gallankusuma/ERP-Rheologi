const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'erp_manufacturing'
  });

  console.log('🔍 Finding unmatched AHSP resources...\n');

  // Get unmatched items (resource_id = 0 or NULL)
  const [unmatched] = await conn.query(`
    SELECT DISTINCT section, resource_name, resource_satuan, COUNT(*) as usage_count
    FROM ahsp_items
    WHERE (resource_id = 0 OR resource_id IS NULL) AND resource_name IS NOT NULL
    GROUP BY section, resource_name, resource_satuan
    ORDER BY section, usage_count DESC
  `);

  console.log(`Found ${unmatched.length} unique unmatched resources\n`);

  // Group by section
  const labor = unmatched.filter(r => r.section === 'A');
  const material = unmatched.filter(r => r.section === 'B');
  const equipment = unmatched.filter(r => r.section === 'C');

  console.log('=== SECTION A - LABOR (Tenaga Kerja) ===');
  console.log(`Total: ${labor.length} unique items\n`);
  labor.slice(0, 20).forEach(r => {
    console.log(`  ${r.resource_name} (${r.resource_satuan || 'N/A'}) - used ${r.usage_count}x`);
  });

  console.log('\n=== SECTION B - MATERIAL (Bahan) ===');
  console.log(`Total: ${material.length} unique items\n`);
  material.slice(0, 30).forEach(r => {
    console.log(`  ${r.resource_name} (${r.resource_satuan || 'N/A'}) - used ${r.usage_count}x`);
  });

  console.log('\n=== SECTION C - EQUIPMENT (Peralatan) ===');
  console.log(`Total: ${equipment.length} unique items\n`);
  equipment.slice(0, 20).forEach(r => {
    console.log(`  ${r.resource_name} (${r.resource_satuan || 'N/A'}) - used ${r.usage_count}x`);
  });

  // Get existing master data names for comparison
  console.log('\n\n📋 Existing Master Data:\n');
  
  const [laborMaster] = await conn.query('SELECT name FROM master_labor WHERE is_active = 1 ORDER BY name');
  console.log('=== LABOR MASTER ===');
  laborMaster.forEach(r => console.log(`  - ${r.name}`));

  const [materialMaster] = await conn.query('SELECT name FROM master_materials WHERE is_active = 1 ORDER BY name LIMIT 30');
  console.log('\n=== MATERIAL MASTER (showing 30) ===');
  materialMaster.forEach(r => console.log(`  - ${r.name}`));

  await conn.end();
})().catch(console.error);
