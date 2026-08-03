CREATE TABLE IF NOT EXISTS client_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(10) NOT NULL,
  description VARCHAR(255),
  color VARCHAR(20) DEFAULT '#3B82F6',
  sort_order INT DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_code (code)
);

INSERT IGNORE INTO client_categories (name, code, sort_order) VALUES
  ('Buyer', 'BUY', 1),
  ('Vendor', 'VND', 2),
  ('Supplier', 'SUP', 3),
  ('Distributor', 'DST', 4),
  ('Contractor', 'CTR', 5),
  ('Partner', 'PTR', 6);
