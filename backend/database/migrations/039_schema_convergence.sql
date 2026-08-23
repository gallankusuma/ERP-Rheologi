-- REV4-P0-1 + REV4-P0-2: Schema convergence migration (safe, non-destructive)
-- Purpose: converge fresh and legacy schemas to the canonical lot contract
-- NEVER deletes, merges, or silently rewrites posted lot/business history
-- Fails loudly on conflicts instead of auto-resolving

-- (removed: schema_migrations ledger — canonical ledger is _migration_ledger managed by runner)

-- 1. wo_qc_checkpoints — missing from all migrations, required by production and QC
CREATE TABLE IF NOT EXISTS wo_qc_checkpoints (
  id INT PRIMARY KEY AUTO_INCREMENT,
  wo_id INT NOT NULL,
  process_stage VARCHAR(100) NOT NULL,
  is_mandatory TINYINT(1) NOT NULL DEFAULT 1,
  qc_type VARCHAR(50) NOT NULL DEFAULT 'LP' COMMENT 'LP=Line Process, FG=Finished Goods',
  status ENUM('pending', 'in_review', 'passed', 'failed', 'skipped') NOT NULL DEFAULT 'pending',
  fpa_id INT NULL COMMENT 'linked QC analysis request',
  triggered_at TIMESTAMP NULL,
  resolved_at TIMESTAMP NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_wqc_wo (wo_id),
  INDEX idx_wqc_fpa (fpa_id),
  INDEX idx_wqc_status (status),
  CONSTRAINT fk_wqc_wo FOREIGN KEY (wo_id) REFERENCES work_orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. preflight-only check for lot source duplicates
-- DOES NOT delete or merge — fails with signal if conflicts exist
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS preflight_lot_source_unique()
BEGIN
  DECLARE dup_count INT DEFAULT 0;
  DECLARE policy_null_count INT DEFAULT 0;
  DECLARE lot_dup_count INT DEFAULT 0;

  -- check source tuple duplicates
  IF EXISTS (SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory_lots') THEN
    SELECT COUNT(*) INTO dup_count
    FROM (
      SELECT source_type, source_document_id, source_line_id
      FROM inventory_lots
      WHERE source_type IS NOT NULL AND source_document_id IS NOT NULL
      GROUP BY source_type, source_document_id, source_line_id
      HAVING COUNT(*) > 1
    ) dupes;

    IF dup_count > 0 THEN
      -- materialize conflict report for manual resolution
      CREATE TABLE IF NOT EXISTS _migration_preflight_conflicts (
        conflict_type VARCHAR(50), table_name VARCHAR(100),
        record_id INT, detail TEXT, detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO _migration_preflight_conflicts (conflict_type, table_name, record_id, detail)
      SELECT 'LOT_SOURCE_DUPLICATE', 'inventory_lots', il.id,
        CONCAT('source_type=', IFNULL(il.source_type,'NULL'), ' doc=', IFNULL(il.source_document_id,'NULL'), ' line=', IFNULL(il.source_line_id,'NULL'))
      FROM inventory_lots il
      INNER JOIN (
        SELECT source_type, source_document_id, source_line_id, MIN(id) AS keep_id
        FROM inventory_lots
        WHERE source_type IS NOT NULL AND source_document_id IS NOT NULL
        GROUP BY source_type, source_document_id, source_line_id
        HAVING COUNT(*) > 1
      ) dups ON il.source_type = dups.source_type
        AND il.source_document_id = dups.source_document_id
        AND il.source_line_id = dups.source_line_id;

      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'MIGRATION_LOT_SOURCE_DUPLICATES: resolve _migration_preflight_conflicts before retrying';
    END IF;

    -- check lot_number duplicates
    SELECT COUNT(*) INTO lot_dup_count
    FROM (
      SELECT lot_number FROM inventory_lots
      WHERE lot_number IS NOT NULL
      GROUP BY lot_number HAVING COUNT(*) > 1
    ) ln_dupes;

    IF lot_dup_count > 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'MIGRATION_LOT_NUMBER_DUPLICATES: duplicate lot_numbers found, resolve before retrying';
    END IF;

    -- safe to add unique constraints
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
      WHERE CONSTRAINT_NAME = 'uq_lot_source' AND TABLE_NAME = 'inventory_lots' AND TABLE_SCHEMA = DATABASE()
    ) THEN
      ALTER TABLE inventory_lots ADD UNIQUE KEY uq_lot_source (source_type, source_document_id, source_line_id);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
      WHERE CONSTRAINT_NAME = 'uq_lot_number' AND TABLE_NAME = 'inventory_lots' AND TABLE_SCHEMA = DATABASE()
    ) THEN
      ALTER TABLE inventory_lots ADD UNIQUE KEY uq_lot_number (lot_number);
    END IF;
  END IF;

  -- check unresolved QC policy
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'qc_policy' AND IS_NULLABLE = 'YES') THEN
    SELECT COUNT(*) INTO policy_null_count FROM products WHERE qc_policy IS NULL;

    IF policy_null_count > 0 THEN
      CREATE TABLE IF NOT EXISTS _migration_preflight_conflicts (
        conflict_type VARCHAR(50), table_name VARCHAR(100),
        record_id INT, detail TEXT, detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO _migration_preflight_conflicts (conflict_type, table_name, record_id, detail)
      SELECT 'QC_POLICY_UNRESOLVED', 'products', id, CONCAT('product=', name, ' sku=', IFNULL(sku,'NULL'))
      FROM products WHERE qc_policy IS NULL;

      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'MIGRATION_QC_POLICY_UNRESOLVED: set qc_policy on all products listed in _migration_preflight_conflicts before retrying';
    END IF;

    -- all products have explicit policy, safe to make NOT NULL
    ALTER TABLE products MODIFY COLUMN qc_policy ENUM('REQUIRED', 'NOT_REQUIRED') NOT NULL DEFAULT 'REQUIRED';
  END IF;
END //
DELIMITER ;
CALL preflight_lot_source_unique();
DROP PROCEDURE IF EXISTS preflight_lot_source_unique;

-- 3. decimal precision on quantity columns
ALTER TABLE inventory_stocks MODIFY COLUMN quantity DECIMAL(15,4) NOT NULL DEFAULT 0;

-- 4. wo_qc_checkpoints FK to qc_analysis_requests
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS ensure_wqc_fpa_fk()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_NAME = 'fk_wqc_fpa' AND TABLE_NAME = 'wo_qc_checkpoints' AND TABLE_SCHEMA = DATABASE()
  ) THEN
    ALTER TABLE wo_qc_checkpoints ADD CONSTRAINT fk_wqc_fpa FOREIGN KEY (fpa_id) REFERENCES qc_analysis_requests(id) ON DELETE SET NULL;
  END IF;
END //
DELIMITER ;
CALL ensure_wqc_fpa_fk();
DROP PROCEDURE IF EXISTS ensure_wqc_fpa_fk;

-- 5. idempotency improvements: scoped key + payload hash + outcome storage
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS idempotency_scope VARCHAR(50) NULL COMMENT 'GRN_POST, FG_RECEIPT, WO_ISSUE';
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS payload_hash VARCHAR(64) NULL;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS stored_response_status INT NULL COMMENT 'HTTP status of original response';
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS stored_response_body TEXT NULL COMMENT 'JSON body for replay';
CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_idemp_scope ON stock_movements(idempotency_scope, idempotency_key);

-- (removed: self-record into schema_migrations — runner handles recording)
