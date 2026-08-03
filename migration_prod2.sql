-- =============================================
-- PRODUCTION MIGRATION PART 2: PPIC + QC tables
-- ADD-only, safe for existing data
-- =============================================

-- Add missing columns to work_orders
DELIMITER //
CREATE PROCEDURE add_wo_columns()
BEGIN
  IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='erp_rheologi' AND TABLE_NAME='work_orders' AND COLUMN_NAME='so_id') THEN
    ALTER TABLE work_orders ADD COLUMN so_id INT DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='erp_rheologi' AND TABLE_NAME='work_orders' AND COLUMN_NAME='mps_detail_id') THEN
    ALTER TABLE work_orders ADD COLUMN mps_detail_id INT DEFAULT NULL;
  END IF;
END //
DELIMITER ;
CALL add_wo_columns();
DROP PROCEDURE IF EXISTS add_wo_columns;
