SET GLOBAL log_bin_trust_function_creators = 1;

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  table_name VARCHAR(100) NOT NULL,
  record_id INT,
  action VARCHAR(10) NOT NULL,
  old_data JSON,
  new_data JSON,
  user_id INT,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_table_action (table_name, action),
  INDEX idx_created_at (created_at)
);

DROP TRIGGER IF EXISTS trg_bom_headers_delete;
DELIMITER //
CREATE TRIGGER trg_bom_headers_delete BEFORE DELETE ON bom_headers FOR EACH ROW
BEGIN
  INSERT INTO audit_log (table_name, record_id, action, old_data)
  VALUES ('bom_headers', OLD.id, 'DELETE', JSON_OBJECT('id', OLD.id, 'product_name', OLD.product_name, 'product_id', OLD.product_id, 'status', OLD.status));
END//
DELIMITER ;

DROP TRIGGER IF EXISTS trg_work_orders_delete;
DELIMITER //
CREATE TRIGGER trg_work_orders_delete BEFORE DELETE ON work_orders FOR EACH ROW
BEGIN
  INSERT INTO audit_log (table_name, record_id, action, old_data)
  VALUES ('work_orders', OLD.id, 'DELETE', JSON_OBJECT('id', OLD.id, 'wo_number', OLD.wo_number, 'product_id', OLD.product_id, 'status', OLD.status));
END//
DELIMITER ;

DROP TRIGGER IF EXISTS trg_products_delete;
DELIMITER //
CREATE TRIGGER trg_products_delete BEFORE DELETE ON products FOR EACH ROW
BEGIN
  INSERT INTO audit_log (table_name, record_id, action, old_data)
  VALUES ('products', OLD.id, 'DELETE', JSON_OBJECT('id', OLD.id, 'name', OLD.name, 'sku', OLD.sku));
END//
DELIMITER ;

SELECT 'AUDIT LOG + TRIGGERS CREATED' AS result;
