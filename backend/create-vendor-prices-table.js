const mysql = require('mysql2/promise');

async function createVendorPricesTable() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'erp_manufacturing',
  });

  try {
    const connection = await pool.getConnection();

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS vendor_prices (
        id INT PRIMARY KEY AUTO_INCREMENT,
        vendor_id INT NOT NULL,
        product_id INT NOT NULL,
        price DECIMAL(15,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'IDR',
        effective_date DATE NOT NULL,
        valid_until DATE NULL,
        min_order_qty DECIMAL(15,4) NULL,
        lead_time_days INT NULL,
        notes TEXT NULL,
        created_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_vendor_prices_vendor (vendor_id),
        INDEX idx_vendor_prices_product (product_id),
        INDEX idx_vendor_prices_effective (effective_date),
        CONSTRAINT fk_vendor_prices_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
        CONSTRAINT fk_vendor_prices_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        CONSTRAINT fk_vendor_prices_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('✓ vendor_prices table ready');

    connection.release();
    pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

createVendorPricesTable();
