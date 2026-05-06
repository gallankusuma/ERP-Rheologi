const mysql = require('mysql2/promise');

async function fixPurchaseRequestsConstraint() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'erp_manufacturing'
    });

    console.log('🔧 Fixing purchase_requests requester_id constraint...');

    // Step 1: Get existing FK constraints on requestor_id
    const [constraints] = await connection.query(`
      SELECT CONSTRAINT_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'purchase_requests'
        AND COLUMN_NAME = 'requestor_id'
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `, [process.env.DB_NAME || 'erp_manufacturing']);

    // Step 2: Drop existing FK constraint if it exists
    if (constraints.length > 0) {
      const constraintName = constraints[0].CONSTRAINT_NAME;
      console.log(`  Dropping existing FK constraint: ${constraintName}`);
      await connection.query(`
        ALTER TABLE purchase_requests 
        DROP FOREIGN KEY ${constraintName}
      `);
      console.log('  ✅ FK constraint dropped');
    } else {
      console.log('  ℹ️  No existing FK constraint found on requestor_id');
    }

    // Step 3: Modify requester_id to be explicitly nullable
    console.log('  Making requestor_id nullable...');
    await connection.query(`
      ALTER TABLE purchase_requests 
      MODIFY COLUMN requestor_id INT NULL
    `);
    console.log('  ✅ requestor_id is now nullable');

    // Step 4: Add FK constraint that allows NULL with ON DELETE SET NULL
    console.log('  Adding FK constraint with ON DELETE SET NULL...');
    try {
      await connection.query(`
        ALTER TABLE purchase_requests 
        ADD CONSTRAINT fk_purchase_requests_requestor 
        FOREIGN KEY (requestor_id) REFERENCES users(id) ON DELETE SET NULL
      `);
      console.log('  ✅ FK constraint added successfully');
    } catch (error) {
      if (error.message.includes('Duplicate')) {
        console.log('  ℹ️  FK constraint already exists (fk_purchase_requests_requestor)');
      } else {
        throw error;
      }
    }

    // Step 5: Also fix approved_by FK if needed
    const [approvedByConstraints] = await connection.query(`
      SELECT CONSTRAINT_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'purchase_requests'
        AND COLUMN_NAME = 'approved_by'
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `, [process.env.DB_NAME || 'erp_manufacturing']);

    if (approvedByConstraints.length > 0) {
      const constraintName = approvedByConstraints[0].CONSTRAINT_NAME;
      await connection.query(`
        ALTER TABLE purchase_requests 
        DROP FOREIGN KEY ${constraintName}
      `);
      
      await connection.query(`
        ALTER TABLE purchase_requests 
        ADD CONSTRAINT fk_purchase_requests_approved_by 
        FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
      `);
      console.log('  ✅ approved_by FK also fixed');
    }

    // Step 6: Verify the change
    const [verifyResult] = await connection.query(`
      SHOW CREATE TABLE purchase_requests
    `);

    console.log('\n📋 Purchase Requests Table Structure (excerpt):');
    const createStatement = verifyResult[0]['Create Table'];
    // Show FK constraints
    const fkLines = createStatement.split('\n').filter(line => line.includes('FOREIGN KEY'));
    fkLines.forEach(line => console.log('   ' + line.trim()));

    console.log('\n✅ Purchase requests requester_id constraint fixed successfully!');
    console.log('   - requestor_id is now nullable (NULL values allowed)');
    console.log('   - FK constraint allows NULL on insert');
    console.log('   - ON DELETE SET NULL will nullify deleted user references');

  } catch (error) {
    console.error('❌ Error fixing constraint:', error.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

fixPurchaseRequestsConstraint();
