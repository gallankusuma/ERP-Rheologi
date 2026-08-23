CREATE TABLE IF NOT EXISTS rnd_document_folders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  color VARCHAR(7) DEFAULT '#3B82F6',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES rnd_projects(id) ON DELETE CASCADE
) ENGINE=InnoDB;

ALTER TABLE rnd_documents ADD COLUMN IF NOT EXISTS folder_id INT NULL;

-- '0000-00-00' is not a date, it is a placeholder left by a permissive server setting.
-- Adding the foreign key rebuilds the table, and a strict server rejects those rows, so the
-- invalid values are repaired to NULL first. The column is nullable, and no real timestamp
-- is lost because a zero date never carried one.
SET @erp_sql_mode = @@SESSION.sql_mode;
SET SESSION sql_mode = '';
UPDATE rnd_documents SET created_at = NULL WHERE CAST(created_at AS CHAR) LIKE '0000-00-00%';
SET SESSION sql_mode = @erp_sql_mode;

-- named and guarded: an unnamed foreign key would be added again on every rerun
ALTER TABLE rnd_documents
  ADD CONSTRAINT IF NOT EXISTS fk_rnd_documents_folder
  FOREIGN KEY (folder_id) REFERENCES rnd_document_folders(id) ON DELETE SET NULL;
