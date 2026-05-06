const mysql = require('mysql2/promise');

async function cleanupVendorColumns() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'erp_manufacturing'
  });

  try {
    console.log('🔗 Connected to MySQL database');

    // Check current data
    const [materials] = await connection.query('SELECT id, code, name, vendor, vendor_id FROM master_materials LIMIT 5');
    console.log('\n📊 Sample data from master_materials:');
    materials.forEach(m => {
      console.log(`  - ${m.code}: vendor="${m.vendor}" | vendor_id=${m.vendor_id}`);
    });

    // Drop vendor text column from master_materials
    console.log('\n🗑️  Removing vendor text column from master_materials...');
    await connection.query('ALTER TABLE master_materials DROP COLUMN vendor');
    console.log('✅ Dropped vendor text column from master_materials');

    // Drop vendor text column from master_equipment  
    console.log('\n🗑️  Removing vendor text column from master_equipment...');
    const [equipColumns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'erp_manufacturing' 
      AND TABLE_NAME = 'master_equipment' 
      AND COLUMN_NAME = 'vendor'
    `);
    
    if (equipColumns.length > 0) {
      await connection.query('ALTER TABLE master_equipment DROP COLUMN vendor');
      console.log('✅ Dropped vendor text column from master_equipment');
    } else {
      console.log('ℹ️  master_equipment doesn\'t have vendor text column');
    }

    console.log('\n✅ Cleanup complete!');
    console.log('📋 Tables now use only vendor_id (foreign key to vendors table)');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

cleanupVendorColumns();
