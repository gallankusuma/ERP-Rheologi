-- PLAY-NEXT-P0-1: canonical lot contract with enforced uniqueness and FKs
-- replaces 017_canonical_lot_contract.sql
-- safe for fresh schema; legacy handling via IF NOT EXISTS

-- 1. canonical lot table with immutable source lineage
CREATE TABLE IF NOT EXISTS inventory_lots (
  id INT PRIMARY KEY AUTO_INCREMENT,
  lot_number VARCHAR(100) NOT NULL,
  product_id INT NOT NULL,
  source_type ENUM('grn_item', 'fg_receipt', 'adjustment', 'opening') NOT NULL,
  source_document_id INT NULL COMMENT 'grn_id or wo_id depending on source_type',
  source_line_id INT NULL COMMENT 'grn_item_id or fg_receipt event id',
  batch_number VARCHAR(100) NULL,
  supplier_id INT NULL,
  manufacture_date DATE NULL,
  expiry_date DATE NULL,
  qc_policy ENUM('REQUIRED', 'NOT_REQUIRED') NOT NULL DEFAULT 'REQUIRED',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- immutable source uniqueness: one source event = one lot
  UNIQUE KEY uq_lot_source (source_type, source_document_id, source_line_id),
  UNIQUE KEY uq_lot_number (lot_number),

  FOREIGN KEY (product_id) REFERENCES products(id),
  INDEX idx_lot_product (product_id),
  INDEX idx_lot_batch (batch_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. add lot_id columns to consumers
ALTER TABLE inventory_stocks ADD COLUMN IF NOT EXISTS lot_id INT NULL AFTER grn_id;
ALTER TABLE inventory_stocks ADD COLUMN IF NOT EXISTS batch_number VARCHAR(100) NULL AFTER lot_id;
ALTER TABLE inventory_stocks ADD COLUMN IF NOT EXISTS source_type VARCHAR(50) NULL AFTER batch_number;
ALTER TABLE inventory_stocks ADD COLUMN IF NOT EXISTS source_id INT NULL AFTER source_type;

ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS lot_id INT NULL;
ALTER TABLE qc_analysis_requests ADD COLUMN IF NOT EXISTS lot_id INT NULL;
ALTER TABLE wo_material_issues ADD COLUMN IF NOT EXISTS lot_id INT NULL;

-- 3. foreign keys from consumers to inventory_lots
-- use IF NOT EXISTS pattern via procedure to handle re-runs
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS add_lot_fks()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_NAME = 'fk_inv_stocks_lot' AND TABLE_SCHEMA = DATABASE()) THEN
    ALTER TABLE inventory_stocks ADD CONSTRAINT fk_inv_stocks_lot FOREIGN KEY (lot_id) REFERENCES inventory_lots(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_NAME = 'fk_stk_mv_lot' AND TABLE_SCHEMA = DATABASE()) THEN
    ALTER TABLE stock_movements ADD CONSTRAINT fk_stk_mv_lot FOREIGN KEY (lot_id) REFERENCES inventory_lots(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_NAME = 'fk_fpa_lot' AND TABLE_SCHEMA = DATABASE()) THEN
    ALTER TABLE qc_analysis_requests ADD CONSTRAINT fk_fpa_lot FOREIGN KEY (lot_id) REFERENCES inventory_lots(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_NAME = 'fk_wmi_lot' AND TABLE_SCHEMA = DATABASE()) THEN
    ALTER TABLE wo_material_issues ADD CONSTRAINT fk_wmi_lot FOREIGN KEY (lot_id) REFERENCES inventory_lots(id);
  END IF;
END //
DELIMITER ;
CALL add_lot_fks();
DROP PROCEDURE IF EXISTS add_lot_fks;

-- 4. lot-based balance uniqueness (one balance per warehouse+lot+status)
CREATE UNIQUE INDEX IF NOT EXISTS uq_inv_wh_lot_status ON inventory_stocks(warehouse_id, lot_id, status);

-- 5. indexes on lot_id columns
CREATE INDEX IF NOT EXISTS idx_inv_lot_id ON inventory_stocks(lot_id);
CREATE INDEX IF NOT EXISTS idx_mv_lot_id ON stock_movements(lot_id);
CREATE INDEX IF NOT EXISTS idx_fpa_lot_id ON qc_analysis_requests(lot_id);
CREATE INDEX IF NOT EXISTS idx_inv_source ON inventory_stocks(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_inv_batch ON inventory_stocks(batch_number);
