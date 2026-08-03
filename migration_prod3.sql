-- Add product_id and quantity to client_projects (BOTH databases)
-- Safe: ADD COLUMN IF NOT EXISTS pattern

-- PRODUCTION
DELIMITER //
CREATE PROCEDURE add_project_product_cols_prod()
BEGIN
  IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='erp_rheologi' AND TABLE_NAME='client_projects' AND COLUMN_NAME='product_id') THEN
    ALTER TABLE client_projects ADD COLUMN product_id INT NULL;
  END IF;
  IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='erp_rheologi' AND TABLE_NAME='client_projects' AND COLUMN_NAME='quantity') THEN
    ALTER TABLE client_projects ADD COLUMN quantity DECIMAL(15,4) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='erp_rheologi' AND TABLE_NAME='client_projects' AND COLUMN_NAME='uom') THEN
    ALTER TABLE client_projects ADD COLUMN uom VARCHAR(50) DEFAULT NULL;
  END IF;
END //
DELIMITER ;
CALL add_project_product_cols_prod();
DROP PROCEDURE IF EXISTS add_project_product_cols_prod;
