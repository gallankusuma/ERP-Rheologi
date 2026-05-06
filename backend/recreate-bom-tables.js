const mysql = require('mysql2/promise');

async function forceRecreateBoM() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'erp_manufacturing'
    });

    console.log('🔧 Force dropping and recreating BOM tables...');

    // Drop bom_details first (has FK to bom_headers)
    try {
      await connection.query('DROP TABLE IF EXISTS bom_details');
      console.log('✅ Dropped bom_details');
    } catch (error) {
      console.log('ℹ️ bom_details already removed');
    }

    // Drop bom_headers
    try {
      await connection.query('DROP TABLE IF EXISTS bom_headers');
      console.log('✅ Dropped bom_headers');
    } catch (error) {
      console.log('ℹ️ bom_headers already removed');
    }

    // Recreate bom_headers with correct constraint (no FK on created_by)
    await connection.query(`
      CREATE TABLE bom_headers (
        id INT PRIMARY KEY AUTO_INCREMENT,
        product_name VARCHAR(255),
        product_id INT,
        version INT DEFAULT 1,
        status VARCHAR(20) DEFAULT 'ACTIVE',
        notes TEXT,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        INDEX idx_product_id (product_id),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Recreated bom_headers WITHOUT FK on created_by');

    // Recreate bom_details
    await connection.query(`
      CREATE TABLE bom_details (
        id INT PRIMARY KEY AUTO_INCREMENT,
        bom_header_id INT NOT NULL,
        raw_material_id INT NOT NULL,
        quantity DECIMAL(15,4) NOT NULL,
        unit_of_measure_id INT,
        sequence INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (bom_header_id) REFERENCES bom_headers(id) ON DELETE CASCADE,
        FOREIGN KEY (raw_material_id) REFERENCES products(id),
        FOREIGN KEY (unit_of_measure_id) REFERENCES uom(id),
        INDEX idx_bom_header_id (bom_header_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Recreated bom_details');

    console.log('✅ BOM tables recreated successfully - FK on created_by removed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

forceRecreateBoM();
