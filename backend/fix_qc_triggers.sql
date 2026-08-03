-- Fix 1: Add missing columns to qc_analysis_requests
ALTER TABLE qc_analysis_requests 
  ADD COLUMN reference_number VARCHAR(100) NULL AFTER reference_id,
  ADD COLUMN batch_no VARCHAR(100) NULL AFTER sampling_area_id,
  ADD COLUMN quantity DECIMAL(15,4) NULL AFTER batch_no,
  ADD COLUMN supplier_id INT NULL AFTER quantity,
  ADD COLUMN reviewed_by INT NULL AFTER created_at,
  ADD COLUMN reviewed_at TIMESTAMP NULL AFTER reviewed_by,
  ADD COLUMN review_notes TEXT NULL AFTER reviewed_at;

ALTER TABLE qc_analysis_requests 
  MODIFY COLUMN status VARCHAR(50) DEFAULT 'Pending',
  MODIFY COLUMN result VARCHAR(50) DEFAULT NULL,
  MODIFY COLUMN type VARCHAR(50) DEFAULT 'LP';

SELECT 'FPA_COLUMNS_FIXED' AS result;

-- Fix 2: Fix audit_log triggers
DROP TRIGGER IF EXISTS trg_work_orders_delete;

DELIMITER $$
CREATE TRIGGER trg_work_orders_delete BEFORE DELETE ON work_orders
FOR EACH ROW
BEGIN
  INSERT INTO audit_log (entity_type, entity_id, action, old_values)
  VALUES ('work_orders', OLD.id, 'DELETE', JSON_OBJECT('id', OLD.id, 'wo_number', OLD.wo_number, 'product_id', OLD.product_id, 'status', OLD.status));
END$$

DROP TRIGGER IF EXISTS trg_bom_headers_delete$$
CREATE TRIGGER trg_bom_headers_delete BEFORE DELETE ON bom_headers
FOR EACH ROW
BEGIN
  INSERT INTO audit_log (entity_type, entity_id, action, old_values)
  VALUES ('bom_headers', OLD.id, 'DELETE', JSON_OBJECT('id', OLD.id, 'product_name', OLD.product_name, 'product_id', OLD.product_id, 'status', OLD.status));
END$$

DROP TRIGGER IF EXISTS trg_products_delete$$
CREATE TRIGGER trg_products_delete BEFORE DELETE ON products
FOR EACH ROW
BEGIN
  INSERT INTO audit_log (entity_type, entity_id, action, old_values)
  VALUES ('products', OLD.id, 'DELETE', JSON_OBJECT('id', OLD.id, 'name', OLD.name, 'sku', OLD.sku));
END$$
DELIMITER ;

SELECT 'TRIGGERS_FIXED' AS result;
