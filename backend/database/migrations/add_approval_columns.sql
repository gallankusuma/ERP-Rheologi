-- ================================================================
-- Safe Migration: Add approval workflow columns
-- Compatible with MySQL 8.0 (Ubuntu)
-- Date: 2026-04-25
-- ================================================================

DROP PROCEDURE IF EXISTS add_column_if_not_exists;

DELIMITER //
CREATE PROCEDURE add_column_if_not_exists(
  tbl_name VARCHAR(100),
  col_name VARCHAR(100),
  col_def TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = tbl_name
      AND COLUMN_NAME  = col_name
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', tbl_name, '` ADD COLUMN `', col_name, '` ', col_def);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
    SELECT CONCAT('Added: ', tbl_name, '.', col_name) AS migration_log;
  ELSE
    SELECT CONCAT('Exists: ', tbl_name, '.', col_name) AS migration_log;
  END IF;
END //
DELIMITER ;

-- ===== purchase_requests =====
CALL add_column_if_not_exists('purchase_requests', 'approval_status',          'TINYINT NOT NULL DEFAULT 0 COMMENT "0=pending,1=sv,2=approved,-1=rejected"');
CALL add_column_if_not_exists('purchase_requests', 'approved_by_supervisor_id','INT NULL');
CALL add_column_if_not_exists('purchase_requests', 'approved_by_manager_id',   'INT NULL');
CALL add_column_if_not_exists('purchase_requests', 'approved_at_supervisor',    'TIMESTAMP NULL');
CALL add_column_if_not_exists('purchase_requests', 'approved_at_manager',       'TIMESTAMP NULL');

-- ===== purchase_orders =====
CALL add_column_if_not_exists('purchase_orders', 'approval_status',          'TINYINT NOT NULL DEFAULT 0 COMMENT "0=pending,1=sv,2=approved,-1=rejected"');
CALL add_column_if_not_exists('purchase_orders', 'approved_by_supervisor_id','INT NULL');
CALL add_column_if_not_exists('purchase_orders', 'approved_by_manager_id',   'INT NULL');
CALL add_column_if_not_exists('purchase_orders', 'approved_at_supervisor',    'TIMESTAMP NULL');
CALL add_column_if_not_exists('purchase_orders', 'approved_at_manager',       'TIMESTAMP NULL');

-- ===== goods_receipts =====
CALL add_column_if_not_exists('goods_receipts', 'approval_status',          'TINYINT NOT NULL DEFAULT 0 COMMENT "0=pending,1=sv,2=approved,-1=rejected"');
CALL add_column_if_not_exists('goods_receipts', 'approved_by_supervisor_id','INT NULL');
CALL add_column_if_not_exists('goods_receipts', 'approved_by_manager_id',   'INT NULL');
CALL add_column_if_not_exists('goods_receipts', 'approved_at_supervisor',    'TIMESTAMP NULL');
CALL add_column_if_not_exists('goods_receipts', 'approved_at_manager',       'TIMESTAMP NULL');

-- Cleanup
DROP PROCEDURE IF EXISTS add_column_if_not_exists;

SELECT 'All migrations completed!' AS result;
