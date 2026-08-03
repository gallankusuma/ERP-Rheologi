-- =============================================
-- PRODUCTION MIGRATION: ADD-only (safe)
-- Database: erp_rheologi
-- Date: 2026-05-22
-- =============================================

-- 1. Create leads table
CREATE TABLE IF NOT EXISTS leads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company VARCHAR(200) NOT NULL,
  contact_name VARCHAR(200),
  email VARCHAR(200),
  phone VARCHAR(50),
  stage VARCHAR(50) DEFAULT 'New',
  value DECIMAL(15,2) DEFAULT 0.00,
  probability INT DEFAULT 10,
  source VARCHAR(100),
  color VARCHAR(20),
  notes TEXT,
  assigned_to INT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  client_id INT,
  converted_at TIMESTAMP NULL
);

-- 2. Create project_document_folders table
CREATE TABLE IF NOT EXISTS project_document_folders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  name VARCHAR(200) NOT NULL,
  color VARCHAR(20) DEFAULT '#3b82f6',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Add folder_id column to project_files (if not exists)
-- MySQL doesn't support IF NOT EXISTS for ADD COLUMN, so we use a procedure
DELIMITER //
CREATE PROCEDURE add_folder_id_if_not_exists()
BEGIN
  IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'erp_rheologi'
    AND TABLE_NAME = 'project_files'
    AND COLUMN_NAME = 'folder_id'
  ) THEN
    ALTER TABLE project_files ADD COLUMN folder_id INT NULL;
  END IF;
END //
DELIMITER ;

CALL add_folder_id_if_not_exists();
DROP PROCEDURE IF EXISTS add_folder_id_if_not_exists;
