const mysql = require('mysql2/promise');

async function addApprovalColumns() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'erp_manufacturing',
  });

  try {
    console.log('🔧 Adding approval workflow columns to goods_receipts table...\n');
    
    const columns = [
      { name: 'approval_status', def: 'INT DEFAULT 0 COMMENT "0=pending, 1=supervisor, 2=approved, -1=rejected"' },
      { name: 'approved_by_supervisor_id', def: 'INT NULL' },
      { name: 'approved_by_manager_id', def: 'INT NULL' },
      { name: 'approved_at_supervisor', def: 'TIMESTAMP NULL' },
      { name: 'approved_at_manager', def: 'TIMESTAMP NULL' },
    ];
    
    for (const col of columns) {
      try {
        await connection.query(`ALTER TABLE goods_receipts ADD COLUMN ${col.name} ${col.def}`);
        console.log(`✅ Added: ${col.name}`);
      } catch (error) {
        if (error.message.includes('Duplicate column')) {
          console.log(`⏭️  Skipped: ${col.name} (already exists)`);
        } else {
          console.error(`❌ Error adding ${col.name}:`, error.message);
        }
      }
    }
    
    // Add foreign keys
    try {
      await connection.query(
        `ALTER TABLE goods_receipts 
         ADD CONSTRAINT fk_gr_supervisor 
         FOREIGN KEY (approved_by_supervisor_id) REFERENCES users(id) ON DELETE SET NULL`
      );
      console.log('✅ Added FK: fk_gr_supervisor');
    } catch (error) {
      if (error.message.includes('Duplicate')) {
        console.log('⏭️  Skipped: fk_gr_supervisor (already exists)');
      } else {
        console.error('❌ Error adding FK supervisor:', error.message);
      }
    }
    
    try {
      await connection.query(
        `ALTER TABLE goods_receipts 
         ADD CONSTRAINT fk_gr_manager 
         FOREIGN KEY (approved_by_manager_id) REFERENCES users(id) ON DELETE SET NULL`
      );
      console.log('✅ Added FK: fk_gr_manager');
    } catch (error) {
      if (error.message.includes('Duplicate')) {
        console.log('⏭️  Skipped: fk_gr_manager (already exists)');
      } else {
        console.error('❌ Error adding FK manager:', error.message);
      }
    }
    
    console.log('\n✅ Approval workflow columns added successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  } finally {
    await connection.end();
  }
}

addApprovalColumns();
