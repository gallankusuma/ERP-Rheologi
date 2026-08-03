-- =====================================================
-- RESTORE deleted BOM headers (SAFE - INSERT only)
-- =====================================================

-- Restore BOM id=1 (Cylo @200 ltr -> C2509 @ 200 ltr)
INSERT INTO bom_headers (id, product_name, product_id, version, status, notes, created_by, created_at, updated_at)
VALUES (1, 'C2509 @ 200 ltr', 118, 1, 'ACTIVE', 'BOM Cylo @200 ltr', NULL, FROM_UNIXTIME(1777561642), NOW())
ON DUPLICATE KEY UPDATE product_name = VALUES(product_name);

-- Restore BOM id=2 (Cylo Bind @2.5 gal -> Cylo Bind @ 10 ltr)
INSERT INTO bom_headers (id, product_name, product_id, version, status, notes, created_by, created_at, updated_at)
VALUES (2, 'Cylo Bind @ 10 ltr', 123, 1, 'ACTIVE', 'BOM Cylo Bind @2.5 gal', NULL, FROM_UNIXTIME(1777561642), NOW())
ON DUPLICATE KEY UPDATE product_name = VALUES(product_name);

-- Restore BOM id=3 (Cylo plus @200 ltr)  
INSERT INTO bom_headers (id, product_name, product_id, version, status, notes, created_by, created_at, updated_at)
VALUES (3, 'Cylo plus @200 ltr', 129, 1, 'ACTIVE', 'BOM Cylo Plus @200 ltr', NULL, FROM_UNIXTIME(1777561642), NOW())
ON DUPLICATE KEY UPDATE product_name = VALUES(product_name);

-- Restore BOM id=4 (Cylo Plus @200 ltr - duplicate? check product_id)
-- This was deleted at 02:36 - @3=NULL means product_id was NULL
-- Skip this one as it has no product_id

-- Verify
SELECT id, product_id, product_name, version, status FROM bom_headers ORDER BY id;

-- =====================================================
-- CREATE AUDIT LOG TABLE for tracking all changes
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  table_name VARCHAR(100) NOT NULL,
  record_id INT,
  action ENUM('INSERT','UPDATE','DELETE') NOT NULL,
  old_data JSON,
  new_data JSON,
  user_id INT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_table_action (table_name, action),
  INDEX idx_created_at (created_at)
);

-- =====================================================
-- CREATE TRIGGER: Log BOM deletes automatically
-- =====================================================
DROP TRIGGER IF EXISTS trg_bom_headers_delete;
CREATE TRIGGER trg_bom_headers_delete
BEFORE DELETE ON bom_headers
FOR EACH ROW
INSERT INTO audit_log (table_name, record_id, action, old_data)
VALUES ('bom_headers', OLD.id, 'DELETE', JSON_OBJECT(
  'id', OLD.id,
  'product_name', OLD.product_name,
  'product_id', OLD.product_id,
  'version', OLD.version,
  'status', OLD.status,
  'notes', OLD.notes
));

-- Also track Work Order deletes
DROP TRIGGER IF EXISTS trg_work_orders_delete;
CREATE TRIGGER trg_work_orders_delete
BEFORE DELETE ON work_orders
FOR EACH ROW
INSERT INTO audit_log (table_name, record_id, action, old_data)
VALUES ('work_orders', OLD.id, 'DELETE', JSON_OBJECT(
  'id', OLD.id,
  'wo_number', OLD.wo_number,
  'product_id', OLD.product_id,
  'quantity', OLD.quantity,
  'status', OLD.status
));

-- Track product deletes
DROP TRIGGER IF EXISTS trg_products_delete;
CREATE TRIGGER trg_products_delete
BEFORE DELETE ON products
FOR EACH ROW
INSERT INTO audit_log (table_name, record_id, action, old_data)
VALUES ('products', OLD.id, 'DELETE', JSON_OBJECT(
  'id', OLD.id,
  'name', OLD.name,
  'sku', OLD.sku
));

SELECT 'BOM RESTORED + AUDIT TRIGGERS CREATED' AS result;
SELECT COUNT(*) AS bom_count FROM bom_headers;
