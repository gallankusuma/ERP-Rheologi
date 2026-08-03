CREATE TABLE IF NOT EXISTS document_control (
  id INT AUTO_INCREMENT PRIMARY KEY,
  document_name VARCHAR(255) NOT NULL,
  document_number VARCHAR(100),
  document_type VARCHAR(50),
  issue_date DATE,
  expiry_date DATE,
  reminder_days INT DEFAULT 30,
  file_path VARCHAR(255),
  file_name VARCHAR(255),
  file_size INT,
  mime_type VARCHAR(100),
  status VARCHAR(20) DEFAULT 'Active',
  notes TEXT,
  uploaded_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);
