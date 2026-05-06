const mysql = require('mysql2/promise');

async function fixBOMCreatedByConstraint() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'erp_manufacturing'
    });

    console.log('🔧 Fixing BOM headers created_by constraint...');

    // Step 1: Get existing FK constraints on created_by
    const [constraints] = await connection.query(`
      SELECT CONSTRAINT_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'bom_headers'
        AND COLUMN_NAME = 'created_by'
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `, [process.env.DB_NAME || 'erp_manufacturing']);

    // Step 2: Drop existing FK constraint if it exists
    if (constraints.length > 0) {
      const constraintName = constraints[0].CONSTRAINT_NAME;
      console.log(`  Dropping existing FK constraint: ${constraintName}`);
      await connection.query(`
        ALTER TABLE bom_headers 
        DROP FOREIGN KEY ${constraintName}
      `);
      console.log('  ✅ FK constraint dropped');
    } else {
      console.log('  ℹ️  No existing FK constraint found on created_by');
    }

    // Step 3: Modify created_by to be explicitly nullable
    console.log('  Making created_by nullable...');
    await connection.query(`
      ALTER TABLE bom_headers 
      MODIFY COLUMN created_by INT NULL
    `);
    console.log('  ✅ created_by is now nullable');

    // Step 4: Add FK constraint that allows NULL with ON DELETE SET NULL
    console.log('  Adding FK constraint with ON DELETE SET NULL...');
    try {
      await connection.query(`
        ALTER TABLE bom_headers 
        ADD CONSTRAINT fk_bom_headers_created_by 
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      `);
      console.log('  ✅ FK constraint added successfully');
    } catch (error) {
      if (error.message.includes('Duplicate')) {
        console.log('  ℹ️  FK constraint already exists (fk_bom_headers_created_by)');
      } else {
        throw error;
      }
    }

    // Step 5: Verify the change
    const [verifyResult] = await connection.query(`
      SHOW CREATE TABLE bom_headers
    `);
    
    console.log('\n📋 BOM Headers Table Structure:');
    console.log(verifyResult[0]['Create Table']);
    
    console.log('\n✅ BOM headers created_by constraint fixed successfully!');
    console.log('   - created_by is now nullable (NULL values allowed)');
    console.log('   - FK constraint allows NULL on insert');
    console.log('   - ON DELETE SET NULL will nullify deleted user references');

  } catch (error) {
    console.error('❌ Error fixing constraint:', error.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

fixBOMCreatedByConstraint();
