const mysql = require('mysql2/promise');

async function fixBOMConstraint() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'erp_manufacturing'
    });

    console.log('🔧 Fixing bom_headers foreign key constraint...');

    // Drop the FK constraint on created_by
    try {
      await connection.query(`
        ALTER TABLE bom_headers 
        DROP FOREIGN KEY bom_headers_ibfk_2
      `);
      console.log('✅ Dropped FK constraint on created_by');
    } catch (error) {
      if (error.message.includes('Cant DROP')) {
        console.log('ℹ️ FK constraint bom_headers_ibfk_2 not found (may already be removed)');
      } else {
        throw error;
      }
    }

    // Recreate the constraint as ON DELETE SET NULL (optional FK)
    try {
      await connection.query(`
        ALTER TABLE bom_headers 
        ADD CONSTRAINT bom_headers_ibfk_2 
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      `);
      console.log('✅ Added FK constraint with ON DELETE SET NULL');
    } catch (error) {
      if (error.message.includes('Duplicate')) {
        console.log('ℹ️ FK constraint already exists');
      } else {
        throw error;
      }
    }

    console.log('✅ BOM headers constraint fixed successfully');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

fixBOMConstraint();
