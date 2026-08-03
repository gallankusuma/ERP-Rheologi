CREATE TABLE IF NOT EXISTS forecast_brands (
  id INT AUTO_INCREMENT PRIMARY KEY,
  brand_name VARCHAR(100) NOT NULL,
  product_id INT DEFAULT NULL,
  conversion_rate DECIMAL(15,4) NOT NULL DEFAULT 1.0000,
  conversion_uom VARCHAR(20) DEFAULT 'ltr',
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS forecast_headers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  forecast_number VARCHAR(30) NOT NULL,
  period_year INT NOT NULL,
  period_month INT NOT NULL,
  status VARCHAR(20) DEFAULT 'Draft',
  notes TEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS forecast_week_data (
  id INT AUTO_INCREMENT PRIMARY KEY,
  forecast_header_id INT NOT NULL,
  brand_id INT NOT NULL,
  week_number INT NOT NULL,
  year INT NOT NULL,
  forecast_qty DECIMAL(15,2) DEFAULT 0.00,
  c2509_qty DECIMAL(15,2) DEFAULT 0.00,
  FOREIGN KEY (forecast_header_id) REFERENCES forecast_headers(id) ON DELETE CASCADE,
  FOREIGN KEY (brand_id) REFERENCES forecast_brands(id) ON DELETE CASCADE
);
