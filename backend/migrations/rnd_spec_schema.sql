-- ================================================
-- RnD Specifications Module - Database Schema
-- ================================================

-- 1. Main specifications header table
CREATE TABLE IF NOT EXISTS rnd_specifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  fbox_id INT UNIQUE,
  doc_number VARCHAR(50),
  doc_date DATE,
  process_type VARCHAR(100),
  process_type_code VARCHAR(10),
  sample_name TEXT,
  sample_type VARCHAR(100),
  sample_type_code VARCHAR(20),
  active TINYINT(1) DEFAULT 1,
  notes TEXT,
  revision TINYINT(1) DEFAULT 0,
  revision_no INT DEFAULT 0,
  revision_by VARCHAR(100),
  revision_date DATETIME,
  approve_1 TINYINT(1) DEFAULT 0,
  approve_1_by VARCHAR(100),
  approve_1_date DATETIME,
  source VARCHAR(20) DEFAULT 'FBOX',
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_doc_number (doc_number),
  INDEX idx_process_type_code (process_type_code),
  INDEX idx_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Detail samples per specification
CREATE TABLE IF NOT EXISTS rnd_spec_samples (
  id INT AUTO_INCREMENT PRIMARY KEY,
  spec_id INT NOT NULL,
  sample_code VARCHAR(50),
  sample_name TEXT,
  brand VARCHAR(200),
  sample_point VARCHAR(200),
  sample_type VARCHAR(50),
  status_spek VARCHAR(20),
  status_off_spek VARCHAR(50),
  sort_order INT DEFAULT 0,
  FOREIGN KEY (spec_id) REFERENCES rnd_specifications(id) ON DELETE CASCADE,
  INDEX idx_spec_id (spec_id),
  INDEX idx_sample_code (sample_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Parameters per sample
CREATE TABLE IF NOT EXISTS rnd_spec_parameters (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sample_id INT NOT NULL,
  parameter_name VARCHAR(200),
  method VARCHAR(200),
  unit VARCHAR(50),
  specification TEXT,
  frequency VARCHAR(100),
  setup_type VARCHAR(100),
  active TINYINT(1) DEFAULT 1,
  sort_order INT DEFAULT 0,
  FOREIGN KEY (sample_id) REFERENCES rnd_spec_samples(id) ON DELETE CASCADE,
  INDEX idx_sample_id (sample_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Items linked to specification
CREATE TABLE IF NOT EXISTS rnd_spec_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  spec_id INT NOT NULL,
  item_code VARCHAR(50),
  item_description TEXT,
  unit VARCHAR(50),
  product_id INT,
  FOREIGN KEY (spec_id) REFERENCES rnd_specifications(id) ON DELETE CASCADE,
  INDEX idx_spec_id (spec_id),
  INDEX idx_item_code (item_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Verify
SELECT 'Tables created successfully' AS status;
SHOW TABLES LIKE 'rnd_spec%';
