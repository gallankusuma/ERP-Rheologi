const mysql = require('mysql2/promise');

async function alterBomHeadersTable() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'erp_manufacturing'
    });

    console.log('🔧 Modifying bom_headers table...');

    const [columns] = await connection.query(`
      SELECT COLUMN_NAME
      FROM information_schema.columns
      WHERE table_schema = 'erp_manufacturing'
        AND table_name = 'bom_headers'
        AND column_name = 'product_name'
    `);

    if (columns.length === 0) {
      await connection.query(`
        ALTER TABLE bom_headers 
        ADD COLUMN product_name VARCHAR(255) NULL AFTER id
      `);
      console.log('✅ Added product_name column');
    } else {
      console.log('ℹ️ product_name column already exists');
    }

    const [fks] = await connection.query(`
      SELECT constraint_name
      FROM information_schema.key_column_usage
      WHERE table_schema = 'erp_manufacturing'
        AND table_name = 'bom_headers'
        AND column_name = 'product_id'
        AND referenced_table_name IS NOT NULL
    `);

    if (fks.length > 0) {
      await connection.query(`
        ALTER TABLE bom_headers 
        DROP FOREIGN KEY ${fks[0].constraint_name}
      `);
      console.log('✅ Removed product_id foreign key constraint');
    } else {
      console.log('ℹ️ product_id foreign key constraint already removed');
    }

    await connection.query(`
      ALTER TABLE bom_headers 
      MODIFY COLUMN product_id INT(11) NULL
    `);
    console.log('✅ Made product_id nullable');

    console.log('✅ bom_headers table modified successfully');

  } catch (error) {
    console.error('❌ Migration error:', error.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

alterBomHeadersTable();
