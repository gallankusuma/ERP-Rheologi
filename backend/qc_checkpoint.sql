CREATE TABLE IF NOT EXISTS wo_qc_checkpoints (
  id INT AUTO_INCREMENT PRIMARY KEY,
  wo_id INT NOT NULL,
  process_stage VARCHAR(100) NOT NULL,
  is_mandatory BOOLEAN DEFAULT TRUE,
  qc_type VARCHAR(50) DEFAULT 'LP',
  status VARCHAR(50) DEFAULT 'pending',
  fpa_id INT NULL,
  triggered_at TIMESTAMP NULL,
  resolved_at TIMESTAMP NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_wo_id (wo_id),
  FOREIGN KEY (wo_id) REFERENCES work_orders(id) ON DELETE CASCADE
);
SELECT 'wo_qc_checkpoints created' AS status;
