CREATE TABLE IF NOT EXISTS vendor_prices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vendor_id INT NOT NULL,
  product_id INT NOT NULL,
  price DECIMAL(18,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'IDR',
  effective_date DATE NOT NULL,
  valid_until DATE DEFAULT NULL,
  min_order_qty DECIMAL(18,2) DEFAULT 0,
  lead_time_days INT DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_vendor_product (vendor_id, product_id)
);
