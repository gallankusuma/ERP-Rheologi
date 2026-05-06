const mysql = require('mysql2/promise');

async function getExistingColumns(connection, tableName) {
  const [rows] = await connection.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName]
  );
  return new Set(rows.map((row) => row.COLUMN_NAME));
}

async function addColumnIfMissing(connection, tableName, columnName, definition) {
  const columns = await getExistingColumns(connection, tableName);
  if (columns.has(columnName)) {
    console.log(`⏭️  Skipped: ${tableName}.${columnName} already exists`);
    return;
  }

  const sql = `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`;
  await connection.query(sql);
  console.log(`✅ Added: ${tableName}.${columnName}`);
}

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'erp_manufacturing',
    multipleStatements: false,
  });

  try {
    console.log('🔧 Ensuring warehouse columns exist (MySQL)...');

    await addColumnIfMissing(connection, 'warehouses', 'address', 'VARCHAR(255)');
    await addColumnIfMissing(connection, 'warehouses', 'contact_person', 'VARCHAR(255)');
    await addColumnIfMissing(connection, 'warehouses', 'is_active', 'TINYINT DEFAULT 1');

    await addColumnIfMissing(connection, 'warehouse_locations', 'rack', 'VARCHAR(50)');
    await addColumnIfMissing(connection, 'warehouse_locations', 'row', 'VARCHAR(50)');
    await addColumnIfMissing(connection, 'warehouse_locations', 'bin', 'VARCHAR(50)');
    await addColumnIfMissing(connection, 'warehouse_locations', 'capacity', 'DECIMAL(10, 2)');
    await addColumnIfMissing(connection, 'warehouse_locations', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

    console.log('✅ Warehouse schema updates complete');
  } catch (error) {
    console.error('❌ Migration failed:', error.message || error);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

run();
