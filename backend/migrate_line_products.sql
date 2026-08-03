-- Line process products junction table + column updates (SAFE)
CREATE TABLE IF NOT EXISTS line_process_products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  line_process_id INT NOT NULL,
  product_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_line_product (line_process_id, product_id),
  FOREIGN KEY (line_process_id) REFERENCES line_processes(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Add capacity_unit_id column to link to UOM (safe, ignore if exists)
ALTER TABLE line_processes ADD COLUMN capacity_unit_id INT NULL AFTER capacity_per_hour;

SELECT 'line_process_products table + capacity_unit_id ready' AS result;
