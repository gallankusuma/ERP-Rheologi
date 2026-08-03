#!/bin/bash
mysql -u erp_user -pErpSecure2024! erp_rheologi << 'EOF'

CREATE TABLE IF NOT EXISTS sample_request_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sample_request_id INT NOT NULL,
  user_id INT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sr_comments_sr (sample_request_id),
  INDEX idx_sr_comments_user (user_id)
);

CREATE TABLE IF NOT EXISTS sample_request_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sample_request_id INT NOT NULL,
  category ENUM('foto','tanda_terima','coa') NOT NULL DEFAULT 'foto',
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INT DEFAULT 0,
  mime_type VARCHAR(100) DEFAULT NULL,
  uploaded_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sr_files_sr (sample_request_id),
  INDEX idx_sr_files_cat (category)
);

EOF

echo "TABLES CREATED OK"
