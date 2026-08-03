-- QC Online Module - Migration 004
-- Creates all QC tables needed for the unified QC Online system

CREATE TABLE IF NOT EXISTS qc_parameters (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
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
  fpa_number VARCHAR(50) NOT NULL,
  type VARCHAR(30) DEFAULT 'Incoming',
  reference_id INT,
  reference_number VARCHAR(50),
  product_id INT NOT NULL,
  sampling_area_id INT,
  batch_no VARCHAR(50),
  quantity DECIMAL(15,2),
  supplier_id INT,
  notes TEXT,
  status VARCHAR(30) DEFAULT 'Draft',
  result VARCHAR(20) DEFAULT NULL,
  created_by INT,
  reviewed_by INT,
  reviewed_at TIMESTAMP NULL,
  review_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qc_analysis_results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  fpa_id INT NOT NULL,
  parameter_id INT NOT NULL,
  instrument_id INT,
  method_id INT,
  standard_value VARCHAR(100),
  min_value DECIMAL(15,4),
  max_value DECIMAL(15,4),
  actual_value VARCHAR(100),
  is_pass TINYINT DEFAULT 0,
  notes TEXT,
  tested_by INT,
  tested_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
