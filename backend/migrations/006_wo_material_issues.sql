-- Sprint 2: wo_material_issues table for granular material issue tracking
-- Each row represents one partial issue event, enabling multi-batch and partial issue support

CREATE TABLE IF NOT EXISTS wo_material_issues (
  id INT PRIMARY KEY AUTO_INCREMENT,
  wo_material_id INT NOT NULL,
  wo_id INT NOT NULL,
  product_id INT NOT NULL,
  warehouse_id INT NOT NULL,
  batch_number VARCHAR(100) NULL,
  quantity DECIMAL(15,4) NOT NULL,
  issued_by INT NULL,
  issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reversal_of INT NULL COMMENT 'If this is a reversal, reference the original issue ID',
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  KEY idx_wmi_wo_material (wo_material_id),
  KEY idx_wmi_wo (wo_id),
  KEY idx_wmi_product (product_id),
  KEY idx_wmi_warehouse (warehouse_id),
  KEY idx_wmi_batch (batch_number),
  CONSTRAINT fk_wmi_wo_material FOREIGN KEY (wo_material_id) REFERENCES wo_materials(id) ON DELETE CASCADE,
  CONSTRAINT fk_wmi_wo FOREIGN KEY (wo_id) REFERENCES work_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_wmi_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_wmi_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  CONSTRAINT fk_wmi_issued_by FOREIGN KEY (issued_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add completed_quantity to work_orders if not exists
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS completed_quantity DECIMAL(15,4) DEFAULT 0;

-- Normalize legacy statuses
UPDATE work_orders SET status = 'in_progress' WHERE status = 'in-progress';
UPDATE work_orders SET status = 'draft' WHERE status IN ('pending', 'planned');
