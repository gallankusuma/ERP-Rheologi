-- Migration 008: CRM Schema Hardening
-- Adds is_archived columns, prospect_activities table, unique constraints, system stage flags

-- 1. Add is_archived to leads (if not exists)
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leads' AND COLUMN_NAME = 'is_archived');
SET @sql = IF(@col_exists = 0, 
  'ALTER TABLE leads ADD COLUMN is_archived TINYINT(1) DEFAULT 0, ADD INDEX idx_leads_archived (is_archived)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Add is_archived to prospects (if not exists)
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prospects' AND COLUMN_NAME = 'is_archived');
SET @sql = IF(@col_exists = 0, 
  'ALTER TABLE prospects ADD COLUMN is_archived TINYINT(1) DEFAULT 0, ADD INDEX idx_prospects_archived (is_archived)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Create prospect_activities table
CREATE TABLE IF NOT EXISTS prospect_activities (
  id INT PRIMARY KEY AUTO_INCREMENT,
  prospect_id INT NOT NULL,
  user_id INT NULL,
  action VARCHAR(100) NOT NULL,
  details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_pa_prospect (prospect_id),
  KEY idx_pa_user (user_id),
  CONSTRAINT fk_pa_prospect FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE,
  CONSTRAINT fk_pa_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Add is_system flag to lead_stages
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lead_stages' AND COLUMN_NAME = 'is_system');
SET @sql = IF(@col_exists = 0, 
  'ALTER TABLE lead_stages ADD COLUMN is_system TINYINT(1) DEFAULT 0',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Mark default stages as system (cannot be deleted/renamed)
UPDATE lead_stages SET is_system = 1 WHERE name IN ('New', 'Qualified', 'Discussion', 'Negotiation', 'Won', 'Lost');

-- 5. Add unique constraints (safe — ignores if already exists)
SET @idx_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prospects' AND INDEX_NAME = 'uq_prospects_code');
SET @sql = IF(@idx_exists = 0, 
  'ALTER TABLE prospects ADD UNIQUE INDEX uq_prospects_code (code)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 6. CRM permissions (idempotent)
INSERT IGNORE INTO permissions (resource, action, module, name, description) VALUES
  ('crm.prospects', 'view', 'CRM - Prospects', 'View Prospects', 'View prospect list and details'),
  ('crm.prospects', 'create', 'CRM - Prospects', 'Create Prospect', 'Create new prospect'),
  ('crm.prospects', 'update', 'CRM - Prospects', 'Update Prospect', 'Edit prospect details'),
  ('crm.prospects', 'delete', 'CRM - Prospects', 'Delete Prospect', 'Archive prospect'),
  ('crm.prospects', 'convert', 'CRM - Prospects', 'Convert Prospect', 'Convert prospect to lead'),
  ('crm.leads', 'view', 'CRM - Leads', 'View Leads', 'View lead list and details'),
  ('crm.leads', 'create', 'CRM - Leads', 'Create Lead', 'Create new lead'),
  ('crm.leads', 'update', 'CRM - Leads', 'Update Lead', 'Edit lead details and stage'),
  ('crm.leads', 'delete', 'CRM - Leads', 'Delete Lead', 'Archive lead'),
  ('crm.leads', 'convert', 'CRM - Leads', 'Convert Lead', 'Convert lead to client');
