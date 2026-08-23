-- Migration 020: Consolidate all runtime ensure* DDL into versioned migration
-- This captures everything previously done by ensureProcurementPaymentSchema,
-- ensureCrmSchema, ensureRnDSchema, ensurePpicSchema, ensureQcSchema,
-- ensureEmailSchema, and ensureApprovalPermissions.
-- All statements use IF NOT EXISTS / IF EXISTS guards for idempotency.

-- procurement and payment schema
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS project_id INT NULL;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS approval_status INT NOT NULL DEFAULT 0;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS expected_date DATE NULL;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NULL DEFAULT 'IDR';
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS payment_term VARCHAR(100) NULL;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS payment_term_2 VARCHAR(255) NULL;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS address TEXT NULL;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS type VARCHAR(50) NULL;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS contact_person VARCHAR(100) NULL;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS delivery_to TEXT NULL;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS advance_payment DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS ppn_percent DECIMAL(5,2) NOT NULL DEFAULT 11;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS po_date DATE NULL;
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS purchase_order_id INT NULL;
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS po_id INT NULL;
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS uom VARCHAR(50) NULL;
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NULL DEFAULT 'IDR';
ALTER TABLE accounts_payable ADD COLUMN IF NOT EXISTS po_schedule_id INT NULL;
ALTER TABLE accounts_payable ADD COLUMN IF NOT EXISTS invoice_date DATE NULL;

CREATE TABLE IF NOT EXISTS wo_daily_schedule (
  id INT PRIMARY KEY AUTO_INCREMENT,
  wo_id INT NOT NULL,
  schedule_date DATE NOT NULL,
  planned_qty DECIMAL(15,2) NOT NULL DEFAULT 0,
  actual_qty DECIMAL(15,2) NULL,
  notes VARCHAR(255) NULL,
  updated_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_wo_day (wo_id, schedule_date),
  KEY idx_schedule_date (schedule_date),
  CONSTRAINT fk_wo_daily_schedule_wo FOREIGN KEY (wo_id) REFERENCES work_orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS client_projects (
  id INT PRIMARY KEY AUTO_INCREMENT,
  project_number VARCHAR(100) NULL,
  project_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS fund_requests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  request_number VARCHAR(100) UNIQUE NOT NULL,
  request_date DATE NOT NULL,
  po_id INT NULL,
  po_schedule_id INT NULL,
  vendor_id INT NULL,
  amount DECIMAL(15,2) NOT NULL,
  needed_date DATE NOT NULL,
  purpose TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  requester_id INT NULL,
  submitted_at TIMESTAMP NULL,
  approved_by INT NULL,
  approved_at TIMESTAMP NULL,
  rejection_reason TEXT NULL,
  notes TEXT NULL,
  cash_account VARCHAR(255) NULL,
  cash_account_note TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_fund_requests_status (status),
  KEY idx_fund_requests_needed_date (needed_date),
  KEY idx_fund_requests_po (po_id),
  KEY idx_fund_requests_schedule (po_schedule_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS approval_requests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  request_number VARCHAR(100) UNIQUE NOT NULL,
  module VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id INT NOT NULL,
  requester_id INT NULL,
  current_step INT DEFAULT 1,
  status VARCHAR(50) DEFAULT 'pending',
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_approval_requests_module_status (module, status),
  KEY idx_approval_requests_entity (entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS purchase_order_payment_schedules (
  id INT PRIMARY KEY AUTO_INCREMENT,
  po_id INT NOT NULL,
  schedule_no INT NOT NULL,
  label VARCHAR(100) NOT NULL,
  trigger_type VARCHAR(50) NOT NULL DEFAULT 'manual',
  percentage DECIMAL(7,2) NOT NULL DEFAULT 0,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  due_date DATE NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'open',
  paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  ap_id INT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_po_schedule_no (po_id, schedule_no),
  KEY idx_po_schedule_due_date (due_date),
  KEY idx_po_schedule_status (status),
  CONSTRAINT fk_po_schedule_po FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS fund_request_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  fund_request_id INT NOT NULL,
  po_id INT NULL,
  po_schedule_id INT NULL,
  vendor_id INT NULL,
  description TEXT NULL,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  approved_by INT NULL,
  approved_at TIMESTAMP NULL,
  rejection_reason TEXT NULL,
  ap_id INT NULL,
  payment_recorded_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_fri_fr (fund_request_id),
  KEY idx_fri_po (po_id),
  KEY idx_fri_schedule (po_schedule_id),
  KEY idx_fri_status (status),
  CONSTRAINT fk_fri_fr FOREIGN KEY (fund_request_id) REFERENCES fund_requests(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS approval_rules (
  id INT PRIMARY KEY AUTO_INCREMENT,
  module VARCHAR(100) NOT NULL,
  name VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_approval_rules_module (module)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS approval_rule_steps (
  id INT PRIMARY KEY AUTO_INCREMENT,
  rule_id INT NOT NULL,
  step_order INT NOT NULL,
  approver_user_id INT NULL,
  approver_role_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_approval_rule_steps_rule (rule_id),
  CONSTRAINT fk_ars_rule FOREIGN KEY (rule_id) REFERENCES approval_rules(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS approval_actions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  request_id INT NOT NULL,
  step_order INT NOT NULL,
  approver_id INT NULL,
  action VARCHAR(50) NOT NULL,
  comments TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_approval_actions_request (request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE users ADD COLUMN IF NOT EXISTS user_level INT NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS selling_price DECIMAL(15,2) DEFAULT 0;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS client_id INT NULL;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS lead_id INT NULL;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS project_id INT NULL;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS expected_ship_date DATE NULL;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NULL DEFAULT 'IDR';

-- CRM schema
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'IDR';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS contact_title VARCHAR(150) NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS industry VARCHAR(100) NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS website VARCHAR(255) NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS address TEXT NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS city VARCHAR(100) NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS country VARCHAR(100) NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS temperature VARCHAR(20) NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS interest TEXT NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_follow_up DATE NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'IDR';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS industry VARCHAR(100) NULL;

-- PPIC schema
CREATE TABLE IF NOT EXISTS mps_detail_sources (
  id INT AUTO_INCREMENT PRIMARY KEY,
  mps_detail_id INT NOT NULL,
  source_type ENUM('SO_ITEM','PROJECT','FORECAST') NOT NULL,
  so_item_id INT NULL,
  project_id INT NULL,
  forecast_header_id INT NULL,
  week_number INT NULL,
  year INT NULL,
  quantity DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_so_item (so_item_id),
  UNIQUE KEY uq_project (project_id),
  KEY idx_detail (mps_detail_id)
);

CREATE TABLE IF NOT EXISTS mrp_material_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  material_id INT NOT NULL,
  lead_time INT DEFAULT 2,
  first_stock DECIMAL(15,2) DEFAULT 0,
  order_quantity DECIMAL(15,2) DEFAULT 0,
  UNIQUE KEY uq_material (material_id)
);

ALTER TABLE line_processes ADD COLUMN IF NOT EXISTS working_hours_per_week DECIMAL(5,1) DEFAULT 40;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS week_number INT NULL;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) DEFAULT 'LEGACY_UNKNOWN';
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS source_reason TEXT NULL;
ALTER TABLE inventory_stocks ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'available';
ALTER TABLE inventory_stocks ADD COLUMN IF NOT EXISTS grn_id INT NULL;
ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) DEFAULT NULL;
ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS mps_header_id INT NULL;
ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS mps_detail_id INT NULL;
ALTER TABLE purchase_request_items ADD COLUMN IF NOT EXISTS mps_detail_ids JSON NULL;
ALTER TABLE bom_headers ADD COLUMN IF NOT EXISTS qty DECIMAL(15,4) NULL;
ALTER TABLE bom_headers ADD COLUMN IF NOT EXISTS unit VARCHAR(50) NULL;

-- permissions schema
ALTER TABLE permissions ADD COLUMN IF NOT EXISTS module VARCHAR(100) NULL;
ALTER TABLE permissions ADD COLUMN IF NOT EXISTS name VARCHAR(200) NULL;

-- email schema
CREATE TABLE IF NOT EXISTS email_accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  email_address VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) DEFAULT NULL,
  imap_host VARCHAR(255) DEFAULT 'imap.gmail.com',
  imap_port INT DEFAULT 993,
  smtp_host VARCHAR(255) DEFAULT 'smtp.gmail.com',
  smtp_port INT DEFAULT 465,
  password_encrypted TEXT NOT NULL,
  is_active TINYINT(1) DEFAULT 1,
  last_synced_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_email_user (user_id)
);

-- sample request tables (from ensureProcurementPaymentSchema)
CREATE TABLE IF NOT EXISTS sample_requests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  request_number VARCHAR(50) NOT NULL UNIQUE,
  client_id INT NOT NULL,
  sales_user_id INT NULL,
  product_name VARCHAR(255) NOT NULL,
  specifications TEXT NULL,
  quantity DECIMAL(15,2) NOT NULL DEFAULT 1,
  unit VARCHAR(20) NULL DEFAULT 'pcs',
  target_delivery_date DATE NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Requested',
  delivery_tracking VARCHAR(255) NULL,
  client_feedback TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sr_client (client_id),
  INDEX idx_sr_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sample_request_comments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sample_request_id INT NOT NULL,
  user_id INT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_src_request (sample_request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sample_request_files (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sample_request_id INT NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'foto',
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INT NULL,
  uploaded_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_srf_request (sample_request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- R&D module tables (from ensureRnDSchema)
CREATE TABLE IF NOT EXISTS rnd_projects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  project_type VARCHAR(50) DEFAULT 'new_product',
  category VARCHAR(50) DEFAULT 'chemical',
  description TEXT,
  objectives TEXT,
  expected_output TEXT,
  status ENUM('draft','active','on_hold','completed','cancelled') DEFAULT 'draft',
  priority ENUM('low','medium','high','critical') DEFAULT 'medium',
  risk_level VARCHAR(50) DEFAULT 'medium',
  confidentiality VARCHAR(50) DEFAULT 'internal',
  regulatory_requirements TEXT,
  target_market TEXT,
  target_product TEXT,
  project_leader_id INT,
  department_id INT,
  start_date DATE,
  target_end_date DATE,
  actual_end_date DATE,
  budget DECIMAL(15,2) DEFAULT 0,
  spent DECIMAL(15,2) DEFAULT 0,
  tags TEXT,
  notes TEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE rnd_projects ADD COLUMN IF NOT EXISTS project_type VARCHAR(50) DEFAULT 'new_product';
ALTER TABLE rnd_projects ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'chemical';
ALTER TABLE rnd_projects ADD COLUMN IF NOT EXISTS expected_output TEXT;
ALTER TABLE rnd_projects ADD COLUMN IF NOT EXISTS risk_level VARCHAR(50) DEFAULT 'medium';
ALTER TABLE rnd_projects ADD COLUMN IF NOT EXISTS confidentiality VARCHAR(50) DEFAULT 'internal';
ALTER TABLE rnd_projects ADD COLUMN IF NOT EXISTS regulatory_requirements TEXT;
ALTER TABLE rnd_projects ADD COLUMN IF NOT EXISTS target_market TEXT;
ALTER TABLE rnd_projects ADD COLUMN IF NOT EXISTS target_product TEXT;
ALTER TABLE rnd_projects ADD COLUMN IF NOT EXISTS tags TEXT;

CREATE TABLE IF NOT EXISTS rnd_formulations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  formula_code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  version VARCHAR(20) DEFAULT '1.0',
  project_id INT,
  product_type_id INT,
  status ENUM('draft','testing','approved','revision','obsolete') DEFAULT 'draft',
  target_specs TEXT,
  description TEXT,
  notes TEXT,
  approved_by INT,
  approved_at DATETIME,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rnd_formulation_ingredients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  formulation_id INT NOT NULL,
  product_id INT,
  ingredient_name VARCHAR(255) NOT NULL,
  quantity DECIMAL(15,4) NOT NULL DEFAULT 0,
  unit VARCHAR(50) DEFAULT 'kg',
  percentage DECIMAL(8,4),
  function_role VARCHAR(100),
  notes TEXT,
  sort_order INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rnd_lab_tests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  test_code VARCHAR(50) NOT NULL UNIQUE,
  test_name VARCHAR(255) NOT NULL,
  formulation_id INT,
  project_id INT,
  batch_number VARCHAR(100),
  test_type ENUM('physical','chemical','microbiological','stability','performance','other') DEFAULT 'chemical',
  method VARCHAR(255),
  equipment VARCHAR(255),
  status ENUM('scheduled','in_progress','completed','failed','cancelled') DEFAULT 'scheduled',
  test_date DATE,
  tested_by INT,
  parameters TEXT,
  results TEXT,
  conclusion ENUM('pass','fail','conditional','pending') DEFAULT 'pending',
  attachments TEXT,
  notes TEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rnd_stability_studies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  study_code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  formulation_id INT,
  batch_number VARCHAR(100),
  status ENUM('planned','active','completed','cancelled') DEFAULT 'planned',
  storage_condition VARCHAR(255) DEFAULT '25C / 60% RH',
  duration_months INT DEFAULT 12,
  start_date DATE,
  end_date DATE,
  protocol TEXT,
  conclusion TEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rnd_stability_checkpoints (
  id INT AUTO_INCREMENT PRIMARY KEY,
  study_id INT NOT NULL,
  checkpoint_month INT NOT NULL DEFAULT 0,
  scheduled_date DATE,
  actual_date DATE,
  status ENUM('pending','completed','skipped') DEFAULT 'pending',
  parameters TEXT,
  results TEXT,
  pass_fail ENUM('pass','fail','pending') DEFAULT 'pending',
  tested_by INT,
  notes TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rnd_milestones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  phase VARCHAR(50) DEFAULT 'formulation_design',
  status VARCHAR(20) DEFAULT 'pending',
  due_date DATE,
  completed_date DATE,
  assigned_to INT,
  deliverables TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rnd_project_tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'todo',
  priority VARCHAR(20) DEFAULT 'medium',
  assigned_to INT,
  due_date DATE,
  completed_date DATE,
  tags TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rnd_document_folders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  color VARCHAR(20) DEFAULT '#3B82F6',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rnd_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT,
  formulation_id INT,
  lab_test_id INT,
  stability_study_id INT,
  doc_type VARCHAR(50) DEFAULT 'other',
  title VARCHAR(255) NOT NULL,
  description TEXT,
  file_name VARCHAR(255),
  file_path VARCHAR(500),
  file_size INT DEFAULT 0,
  mime_type VARCHAR(100),
  version VARCHAR(20) DEFAULT '1.0',
  folder_id INT,
  uploaded_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE rnd_documents ADD COLUMN IF NOT EXISTS folder_id INT NULL;

-- QC base tables (from ensureQcSchema)
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
  process_date TIMESTAMP NULL
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
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- QC column additions (from ensureQcSchema addCol calls)
ALTER TABLE qc_parameters ADD COLUMN IF NOT EXISTS code VARCHAR(50) DEFAULT NULL;
ALTER TABLE qc_parameters ADD COLUMN IF NOT EXISTS param_type VARCHAR(20) DEFAULT 'quantitative';
ALTER TABLE qc_analysis_requests ADD COLUMN IF NOT EXISTS sampling_run INT DEFAULT 1;
ALTER TABLE qc_analysis_requests ADD COLUMN IF NOT EXISTS parent_fpa_id INT;
ALTER TABLE qc_analysis_requests ADD COLUMN IF NOT EXISTS approved_by_1 INT;
ALTER TABLE qc_analysis_requests ADD COLUMN IF NOT EXISTS approved_at_1 TIMESTAMP NULL;
ALTER TABLE qc_analysis_requests ADD COLUMN IF NOT EXISTS approved_by_2 INT;
ALTER TABLE qc_analysis_requests ADD COLUMN IF NOT EXISTS approved_at_2 TIMESTAMP NULL;
ALTER TABLE qc_analysis_requests ADD COLUMN IF NOT EXISTS needs_resampling TINYINT DEFAULT 0;
ALTER TABLE qc_analysis_requests ADD COLUMN IF NOT EXISTS disposition VARCHAR(50);
ALTER TABLE qc_analysis_requests ADD COLUMN IF NOT EXISTS data_complete TINYINT DEFAULT 0;
ALTER TABLE qc_analysis_requests ADD COLUMN IF NOT EXISTS analysis_notes TEXT;
ALTER TABLE qc_analysis_requests ADD COLUMN IF NOT EXISTS wo_id INT;
ALTER TABLE qc_analysis_requests ADD COLUMN IF NOT EXISTS specification_doc VARCHAR(100);
ALTER TABLE qc_analysis_requests ADD COLUMN IF NOT EXISTS sampling_point VARCHAR(255);
ALTER TABLE qc_analysis_requests ADD COLUMN IF NOT EXISTS sampling_qty DECIMAL(15,4);
ALTER TABLE qc_analysis_requests ADD COLUMN IF NOT EXISTS sampling_unit VARCHAR(50);
ALTER TABLE qc_analysis_requests ADD COLUMN IF NOT EXISTS process_type VARCHAR(100);
ALTER TABLE qc_analysis_requests ADD COLUMN IF NOT EXISTS sample_type VARCHAR(100);
ALTER TABLE qc_analysis_requests ADD COLUMN IF NOT EXISTS process_date TIMESTAMP NULL;

ALTER TABLE qc_analysis_results ADD COLUMN IF NOT EXISTS method_id INT;
ALTER TABLE qc_analysis_results ADD COLUMN IF NOT EXISTS standard_value VARCHAR(255);
ALTER TABLE qc_analysis_results ADD COLUMN IF NOT EXISTS min_value FLOAT;
ALTER TABLE qc_analysis_results ADD COLUMN IF NOT EXISTS max_value FLOAT;
ALTER TABLE qc_analysis_results ADD COLUMN IF NOT EXISTS uom VARCHAR(50);
ALTER TABLE qc_analysis_results ADD COLUMN IF NOT EXISTS qc_type VARCHAR(30);
ALTER TABLE qc_analysis_results ADD COLUMN IF NOT EXISTS specification_id INT;
ALTER TABLE qc_analysis_results ADD COLUMN IF NOT EXISTS is_required TINYINT DEFAULT 1;
ALTER TABLE qc_analysis_results ADD COLUMN IF NOT EXISTS param_type VARCHAR(20) DEFAULT 'quantitative';
ALTER TABLE qc_analysis_results ADD COLUMN IF NOT EXISTS saplo FLOAT;
ALTER TABLE qc_analysis_results ADD COLUMN IF NOT EXISTS duplo FLOAT;
ALTER TABLE qc_analysis_results ADD COLUMN IF NOT EXISTS analyst_id INT;
ALTER TABLE qc_analysis_results ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE qc_analysis_results ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- batches audit columns
ALTER TABLE batches ADD COLUMN IF NOT EXISTS qc_status VARCHAR(50);
ALTER TABLE batches ADD COLUMN IF NOT EXISTS released_by INT;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS released_at TIMESTAMP NULL;

-- QC NCR/rework linkage columns
ALTER TABLE qc_ncr ADD COLUMN IF NOT EXISTS source_fpa_id INT NULL;
ALTER TABLE qc_ncr ADD COLUMN IF NOT EXISTS source_type VARCHAR(30) NULL DEFAULT 'manual';
ALTER TABLE qc_rework_orders ADD COLUMN IF NOT EXISTS retest_fpa_id INT NULL;

-- wo_daily_schedule (from ensureProcurementPaymentSchema)
CREATE TABLE IF NOT EXISTS wo_daily_schedule (
  id INT PRIMARY KEY AUTO_INCREMENT,
  wo_id INT NOT NULL,
  schedule_date DATE NOT NULL,
  planned_qty DECIMAL(15,2) NOT NULL DEFAULT 0,
  actual_qty DECIMAL(15,2) NULL,
  notes VARCHAR(255) NULL,
  updated_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_wo_day (wo_id, schedule_date),
  KEY idx_schedule_date (schedule_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
