-- P0-LIVE-1: legacy-safe upgrade for wo_material_issues table
-- handles both fresh databases and databases with the old 006 schema

-- if the old schema exists (has wo_id column but no idempotency_key), upgrade it
-- if no table exists, create the new schema

-- step 1: create table if it doesn't exist at all (fresh databases)
CREATE TABLE IF NOT EXISTS wo_material_issues (
  id INT PRIMARY KEY AUTO_INCREMENT,
  wo_material_id INT NOT NULL,
  wo_id INT NULL,
  warehouse_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity DECIMAL(15,4) NOT NULL,
  batch_number VARCHAR(100) NULL,
  idempotency_key VARCHAR(100) NULL,
  issued_by INT NULL,
  issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  stock_movement_id INT NULL,
  reversal_of INT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_wmi_wo_material (wo_material_id),
  INDEX idx_wmi_product (product_id),
  INDEX idx_wmi_warehouse (warehouse_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- step 2: add missing columns for databases with old 006 schema
ALTER TABLE wo_material_issues ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100) NULL;
ALTER TABLE wo_material_issues ADD COLUMN IF NOT EXISTS stock_movement_id INT NULL;

-- step 3: add unique index for idempotency (safe: ignores if already exists)
CREATE UNIQUE INDEX IF NOT EXISTS uq_issue_key ON wo_material_issues(idempotency_key);
