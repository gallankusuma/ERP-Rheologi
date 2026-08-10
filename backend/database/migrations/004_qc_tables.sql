-- QC Online Module - Migration 004
-- Creates all QC tables needed for the unified QC Online system

CREATE TABLE IF NOT EXISTS qc_parameters (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) DEFAULT NULL,
  param_type VARCHAR(20) DEFAULT 'quantitative',
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qc_methods (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qc_instruments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  calibration_date DATE,
  next_calibration_date DATE,
  status VARCHAR(30) DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qc_sampling_areas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qc_user_areas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  area_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_area (user_id, area_id)
);

CREATE TABLE IF NOT EXISTS qc_specifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  qc_type VARCHAR(30) DEFAULT 'Incoming',
  parameter_id INT NOT NULL,
  method_id INT,
  standard_value VARCHAR(100),
  min_value DECIMAL(15,4),
  max_value DECIMAL(15,4),
  uom VARCHAR(50),
  is_required TINYINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qc_analysis_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  fpa_number VARCHAR(100) NOT NULL,
  type VARCHAR(50) DEFAULT 'LP',
  reference_id INT,
  reference_number VARCHAR(100),
  product_id INT NOT NULL,
  sampling_area_id INT,
  batch_no VARCHAR(100),
  quantity DECIMAL(15,4),
  supplier_id INT,
  status VARCHAR(50) DEFAULT 'Pending',
  result VARCHAR(50) DEFAULT NULL,
  notes TEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_by INT,
  reviewed_at TIMESTAMP NULL,
  review_notes TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  sampling_run INT DEFAULT 1,
  parent_fpa_id INT,
  approved_by_1 INT,
  approved_at_1 TIMESTAMP NULL,
  approved_by_2 INT,
  approved_at_2 TIMESTAMP NULL,
  needs_resampling TINYINT DEFAULT 0,
  disposition VARCHAR(50),
  data_complete TINYINT DEFAULT 0,
  analysis_notes TEXT,
  wo_id INT,
  specification_doc VARCHAR(100),
  sampling_point VARCHAR(255),
  sampling_qty DECIMAL(15,4),
  sampling_unit VARCHAR(50),
  process_type VARCHAR(100),
  sample_type VARCHAR(100),
  process_date TIMESTAMP NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (sampling_area_id) REFERENCES qc_sampling_areas(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS qc_analysis_results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  fpa_id INT NOT NULL,
  parameter_id INT NOT NULL,
  instrument_id INT,
  method_id INT,
  standard_value VARCHAR(255),
  min_value FLOAT,
  max_value FLOAT,
  actual_value VARCHAR(255),
  is_pass TINYINT(1) DEFAULT NULL,
  saplo FLOAT,
  duplo FLOAT,
  analyst_id INT,
  notes TEXT,
  uom VARCHAR(50),
  qc_type VARCHAR(30),
  specification_id INT,
  is_required TINYINT DEFAULT 1,
  param_type VARCHAR(20) DEFAULT 'quantitative',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (fpa_id) REFERENCES qc_analysis_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (parameter_id) REFERENCES qc_parameters(id) ON DELETE CASCADE,
  FOREIGN KEY (instrument_id) REFERENCES qc_instruments(id) ON DELETE SET NULL
);
