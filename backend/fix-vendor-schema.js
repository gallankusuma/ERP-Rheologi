const mysql = require('mysql2/promise');

async function fixVendorSchema() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'erp_manufacturing'
  });

  try {
    console.log('🔗 Connected to MySQL database');

    // Check if vendor column exists (wrong schema)
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'erp_manufacturing' 
      AND TABLE_NAME = 'master_materials' 
      AND COLUMN_NAME IN ('vendor', 'vendor_id')
    `);

    const hasVendor = columns.some(c => c.COLUMN_NAME === 'vendor');
    const hasVendorId = columns.some(c => c.COLUMN_NAME === 'vendor_id');

    console.log('\n📊 Current schema:');
    console.log('  - vendor column (text):', hasVendor ? '✅ EXISTS' : '❌ Not found');
    console.log('  - vendor_id column (FK):', hasVendorId ? '✅ EXISTS' : '❌ Not found');

    // Fix master_materials
    if (hasVendor && !hasVendorId) {
      console.log('\n🔧 Fixing master_materials: Replacing vendor text with vendor_id FK...');
      await connection.query('ALTER TABLE master_materials DROP COLUMN vendor');
      console.log('  ✅ Dropped vendor text column');
      
      await connection.query('ALTER TABLE master_materials ADD COLUMN vendor_id INT AFTER harga');
      console.log('  ✅ Added vendor_id column');
      
      await connection.query('ALTER TABLE master_materials ADD CONSTRAINT fk_materials_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL');
      console.log('  ✅ Added foreign key constraint');
      
      await connection.query('CREATE INDEX idx_vendor_id ON master_materials(vendor_id)');
      console.log('  ✅ Added index on vendor_id');
    } else if (!hasVendorId) {
      console.log('\n🔧 Adding vendor_id to master_materials...');
      await connection.query('ALTER TABLE master_materials ADD COLUMN vendor_id INT AFTER harga');
      await connection.query('ALTER TABLE master_materials ADD CONSTRAINT fk_materials_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL');
      await connection.query('CREATE INDEX idx_vendor_id ON master_materials(vendor_id)');
      console.log('  ✅ Added vendor_id with foreign key');
    } else {
      console.log('\n✅ master_materials already has vendor_id');
    }

    // Check equipment table
    const [equipColumns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'erp_manufacturing' 
      AND TABLE_NAME = 'master_equipment' 
      AND COLUMN_NAME IN ('vendor', 'vendor_id')
    `);

    const equipHasVendor = equipColumns.some(c => c.COLUMN_NAME === 'vendor');
    const equipHasVendorId = equipColumns.some(c => c.COLUMN_NAME === 'vendor_id');

    // Fix master_equipment
    if (equipHasVendor && !equipHasVendorId) {
      console.log('\n🔧 Fixing master_equipment: Replacing vendor text with vendor_id FK...');
      await connection.query('ALTER TABLE master_equipment DROP COLUMN vendor');
      console.log('  ✅ Dropped vendor text column');
      
      await connection.query('ALTER TABLE master_equipment ADD COLUMN vendor_id INT AFTER harga');
      console.log('  ✅ Added vendor_id column');
      
      await connection.query('ALTER TABLE master_equipment ADD CONSTRAINT fk_equipment_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL');
      console.log('  ✅ Added foreign key constraint');
      
      await connection.query('CREATE INDEX idx_equipment_vendor_id ON master_equipment(vendor_id)');
      console.log('  ✅ Added index on vendor_id');
    } else if (!equipHasVendorId) {
      console.log('\n🔧 Adding vendor_id to master_equipment...');
      await connection.query('ALTER TABLE master_equipment ADD COLUMN vendor_id INT AFTER harga');
      await connection.query('ALTER TABLE master_equipment ADD CONSTRAINT fk_equipment_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL');
      await connection.query('CREATE INDEX idx_equipment_vendor_id ON master_equipment(vendor_id)');
      console.log('  ✅ Added vendor_id with foreign key');
    } else {
      console.log('\n✅ master_equipment already has vendor_id');
    }

    console.log('\n✅ Schema fixed successfully!');
    console.log('\n📋 Schema now uses:');
    console.log('  - vendor_id INT (foreign key to vendors table)');
    console.log('  - Vendor names retrieved via JOIN');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

fixVendorSchema();
