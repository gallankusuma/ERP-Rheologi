-- CRM Leads + Project Folders Migration

CREATE TABLE IF NOT EXISTS leads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company VARCHAR(200) NOT NULL,
  contact_name VARCHAR(200),
  email VARCHAR(200),
  phone VARCHAR(50),
  stage VARCHAR(50) DEFAULT 'New',
  value DECIMAL(15,2) DEFAULT 0,
  probability INT DEFAULT 10,
  source VARCHAR(100),
  color VARCHAR(20) DEFAULT NULL,
  notes TEXT,
  assigned_to INT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_document_folders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  name VARCHAR(200) NOT NULL,
  color VARCHAR(20) DEFAULT '#3b82f6',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add folder_id to project_files if not exists
ALTER TABLE project_files ADD COLUMN IF NOT EXISTS folder_id INT DEFAULT NULL;
