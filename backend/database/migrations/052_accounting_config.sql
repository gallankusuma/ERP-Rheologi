-- accounting configuration tables per blueprint §8.1 and §8.4

-- company-level accounting settings
CREATE TABLE IF NOT EXISTS accounting_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT DEFAULT 1,
  base_currency_code VARCHAR(3) NOT NULL DEFAULT 'IDR',
  fiscal_year_start_month INT NOT NULL DEFAULT 1 COMMENT 'January',
  inventory_cost_method ENUM('EXACT_LOT','FIFO','WEIGHTED_AVG') DEFAULT 'EXACT_LOT',
  revenue_recognition_default ENUM('SHIPPED','DELIVERED','INVOICED') DEFAULT 'SHIPPED',
  rounding_account_id INT DEFAULT NULL,
  retained_earnings_account_id INT DEFAULT NULL,
  default_fx_gain_account_id INT DEFAULT NULL,
  default_fx_loss_account_id INT DEFAULT NULL,
  effective_from DATE NOT NULL DEFAULT '2025-01-01',
  effective_to DATE DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_settings_company_effective (company_id, effective_from)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- account roles map role codes to GL accounts with scope/effective dates
CREATE TABLE IF NOT EXISTS account_roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT DEFAULT 1,
  role_code VARCHAR(50) NOT NULL COMMENT 'AR_CONTROL, AP_CONTROL, GRNI, INVENTORY_RM_AVAILABLE, etc.',
  account_id INT NOT NULL,
  product_category_id INT DEFAULT NULL COMMENT 'Optional scope: product category',
  warehouse_id INT DEFAULT NULL COMMENT 'Optional scope: warehouse',
  vendor_class VARCHAR(50) DEFAULT NULL COMMENT 'Optional scope: vendor classification',
  customer_class VARCHAR(50) DEFAULT NULL COMMENT 'Optional scope: customer classification',
  tax_code VARCHAR(20) DEFAULT NULL COMMENT 'Optional scope: tax code',
  project_id INT DEFAULT NULL COMMENT 'Optional scope: project',
  cost_center_id INT DEFAULT NULL COMMENT 'Optional scope: cost center',
  priority INT DEFAULT 0 COMMENT 'Higher priority wins when multiple rules match',
  effective_from DATE NOT NULL DEFAULT '2025-01-01',
  effective_to DATE DEFAULT NULL,
  config_version INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES chart_of_accounts(id),
  INDEX idx_role_lookup (company_id, role_code, effective_from)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- posting profile definitions
CREATE TABLE IF NOT EXISTS posting_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT DEFAULT 1,
  source_event_type VARCHAR(50) NOT NULL COMMENT 'GRN_RECEIPT, VENDOR_INVOICE, MATERIAL_ISSUE, FG_RECEIPT, SHIPMENT, etc.',
  profile_name VARCHAR(100) NOT NULL,
  description TEXT DEFAULT NULL,
  is_active TINYINT(1) DEFAULT 1,
  version INT DEFAULT 1,
  version_hash VARCHAR(64) DEFAULT NULL,
  effective_from DATE NOT NULL DEFAULT '2025-01-01',
  effective_to DATE DEFAULT NULL,
  approved_by INT DEFAULT NULL,
  approved_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_profile_event (company_id, source_event_type, effective_from)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- posting profile rules (line-level debit/credit instructions)
CREATE TABLE IF NOT EXISTS posting_profile_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  posting_profile_id INT NOT NULL,
  line_number INT NOT NULL,
  debit_role_code VARCHAR(50) DEFAULT NULL COMMENT 'Account role for debit side',
  credit_role_code VARCHAR(50) DEFAULT NULL COMMENT 'Account role for credit side',
  amount_expression VARCHAR(100) NOT NULL COMMENT 'Server-side rule: RECEIPT_COST, INVOICE_AMOUNT, ISSUE_COST, TAX_AMOUNT, etc.',
  description VARCHAR(200) DEFAULT NULL,
  required_dimensions JSON DEFAULT NULL COMMENT '["product_id","warehouse_id","lot_id"]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (posting_profile_id) REFERENCES posting_profiles(id),
  UNIQUE KEY uq_rule_line (posting_profile_id, line_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- accounting events: immutable record of every financial posting attempt
CREATE TABLE IF NOT EXISTS accounting_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_uuid VARCHAR(36) NOT NULL UNIQUE,
  company_id INT DEFAULT 1,
  source_module VARCHAR(50) NOT NULL COMMENT 'procurement, production, inventory, sales, finance',
  source_type VARCHAR(50) NOT NULL COMMENT 'grn, vendor_invoice, material_issue, fg_receipt, shipment, manual_journal',
  source_id INT NOT NULL COMMENT 'ID of the source document',
  source_line_id INT DEFAULT NULL,
  source_revision INT DEFAULT 1,
  source_event_type VARCHAR(50) NOT NULL COMMENT 'GRN_POSTED, VENDOR_INVOICE_POSTED, etc.',
  source_business_date DATE NOT NULL,
  source_hash VARCHAR(64) DEFAULT NULL COMMENT 'Hash of source data at event creation time',
  posting_profile_id INT DEFAULT NULL,
  posting_profile_version INT DEFAULT NULL,
  posting_profile_hash VARCHAR(64) DEFAULT NULL,
  status ENUM('RECEIVED','VALIDATED','POSTED','FAILED','REVERSED') DEFAULT 'RECEIVED',
  journal_entry_id INT DEFAULT NULL,
  failure_code VARCHAR(50) DEFAULT NULL,
  failure_message TEXT DEFAULT NULL,
  recovery_state VARCHAR(50) DEFAULT NULL,
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id),
  INDEX idx_event_source (source_module, source_type, source_id),
  UNIQUE KEY uq_event_source (company_id, source_event_type, source_id, source_line_id, source_revision)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- idempotency outcomes: stored HTTP responses for replay
CREATE TABLE IF NOT EXISTS idempotency_outcomes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT DEFAULT 1,
  command_scope VARCHAR(100) NOT NULL COMMENT 'MANUAL_JOURNAL_POST, VENDOR_INVOICE_POST, etc.',
  idempotency_key VARCHAR(128) NOT NULL,
  payload_hash VARCHAR(64) NOT NULL,
  http_status INT NOT NULL,
  response_body JSON DEFAULT NULL,
  accounting_event_id INT DEFAULT NULL,
  journal_entry_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL DEFAULT NULL,
  UNIQUE KEY uq_idempotency (company_id, command_scope, idempotency_key),
  FOREIGN KEY (accounting_event_id) REFERENCES accounting_events(id),
  INDEX idx_idempotency_key (idempotency_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- journal entry sequence table (locked row per company+type for gapless numbers)
CREATE TABLE IF NOT EXISTS journal_sequences (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT DEFAULT 1,
  journal_type VARCHAR(20) NOT NULL COMMENT 'MANUAL, SYSTEM, AP, AR, etc.',
  prefix VARCHAR(10) NOT NULL DEFAULT 'JV',
  current_year INT NOT NULL,
  current_month INT NOT NULL,
  last_number INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_sequence (company_id, journal_type, current_year, current_month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- seed initial accounting settings
INSERT IGNORE INTO accounting_settings (company_id, base_currency_code, fiscal_year_start_month, inventory_cost_method, revenue_recognition_default)
VALUES (1, 'IDR', 1, 'EXACT_LOT', 'SHIPPED');

-- seed core account role mappings
INSERT IGNORE INTO account_roles (company_id, role_code, account_id, effective_from) VALUES
(1, 'CASH_ON_HAND', (SELECT id FROM chart_of_accounts WHERE account_code = '1111'), '2025-01-01'),
(1, 'BANK_OPERATING', (SELECT id FROM chart_of_accounts WHERE account_code = '1112'), '2025-01-01'),
(1, 'AR_CONTROL', (SELECT id FROM chart_of_accounts WHERE account_code = '1120'), '2025-01-01'),
(1, 'UNBILLED_AR', (SELECT id FROM chart_of_accounts WHERE account_code = '1121'), '2025-01-01'),
(1, 'INVENTORY_RM_AVAILABLE', (SELECT id FROM chart_of_accounts WHERE account_code = '1140'), '2025-01-01'),
(1, 'INVENTORY_WIP', (SELECT id FROM chart_of_accounts WHERE account_code = '1141'), '2025-01-01'),
(1, 'INVENTORY_FG_AVAILABLE', (SELECT id FROM chart_of_accounts WHERE account_code = '1142'), '2025-01-01'),
(1, 'INVENTORY_RM_QC_HOLD', (SELECT id FROM chart_of_accounts WHERE account_code = '1143'), '2025-01-01'),
(1, 'INVENTORY_FG_QC_HOLD', (SELECT id FROM chart_of_accounts WHERE account_code = '1144'), '2025-01-01'),
(1, 'INVENTORY_PKG', (SELECT id FROM chart_of_accounts WHERE account_code = '1145'), '2025-01-01'),
(1, 'AP_CONTROL', (SELECT id FROM chart_of_accounts WHERE account_code = '2110'), '2025-01-01'),
(1, 'GRNI', (SELECT id FROM chart_of_accounts WHERE account_code = '2111'), '2025-01-01'),
(1, 'INPUT_TAX', (SELECT id FROM chart_of_accounts WHERE account_code = '1170'), '2025-01-01'),
(1, 'OUTPUT_TAX', (SELECT id FROM chart_of_accounts WHERE account_code = '2131'), '2025-01-01'),
(1, 'RETAINED_EARNINGS', (SELECT id FROM chart_of_accounts WHERE account_code = '3200'), '2025-01-01'),
(1, 'SALES_REVENUE_PRODUCT', (SELECT id FROM chart_of_accounts WHERE account_code = '4110'), '2025-01-01'),
(1, 'SALES_RETURN', (SELECT id FROM chart_of_accounts WHERE account_code = '4140'), '2025-01-01'),
(1, 'COGS_PRODUCT', (SELECT id FROM chart_of_accounts WHERE account_code = '5500'), '2025-01-01'),
(1, 'PURCHASE_PRICE_VARIANCE', (SELECT id FROM chart_of_accounts WHERE account_code = '5600'), '2025-01-01'),
(1, 'PRODUCTION_VARIANCE', (SELECT id FROM chart_of_accounts WHERE account_code = '5700'), '2025-01-01'),
(1, 'SCRAP_ABNORMAL', (SELECT id FROM chart_of_accounts WHERE account_code = '5800'), '2025-01-01'),
(1, 'INVENTORY_VARIANCE', (SELECT id FROM chart_of_accounts WHERE account_code = '6295'), '2025-01-01'),
(1, 'FX_GAIN', (SELECT id FROM chart_of_accounts WHERE account_code = '7201'), '2025-01-01'),
(1, 'FX_LOSS', (SELECT id FROM chart_of_accounts WHERE account_code = '7202'), '2025-01-01'),
(1, 'ROUNDING_DIFFERENCE', (SELECT id FROM chart_of_accounts WHERE account_code = '7901'), '2025-01-01');

-- link accounting_settings to resolved account IDs
UPDATE accounting_settings SET
  rounding_account_id = (SELECT id FROM chart_of_accounts WHERE account_code = '7901'),
  retained_earnings_account_id = (SELECT id FROM chart_of_accounts WHERE account_code = '3200'),
  default_fx_gain_account_id = (SELECT id FROM chart_of_accounts WHERE account_code = '7201'),
  default_fx_loss_account_id = (SELECT id FROM chart_of_accounts WHERE account_code = '7202')
WHERE company_id = 1;
