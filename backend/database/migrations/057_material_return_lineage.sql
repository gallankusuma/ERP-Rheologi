-- Material returns must compensate a specific issue, not a work order material in general.
--
-- Without lineage a return is valued from whatever issue happened last, restores stock to an
-- arbitrary lot row, and never gives quantity back to the cost layer it came from, so physical
-- stock drifts above valuated stock.

ALTER TABLE wo_material_issues
  ADD COLUMN IF NOT EXISTS returned_qty DECIMAL(20,4) NOT NULL DEFAULT 0
    COMMENT 'cumulative quantity returned against this issue',
  ADD COLUMN IF NOT EXISTS return_status VARCHAR(20) NOT NULL DEFAULT 'ISSUED'
    COMMENT 'ISSUED -> PARTIALLY_RETURNED -> RETURNED';

CREATE TABLE IF NOT EXISTS wo_material_returns (
  id INT PRIMARY KEY AUTO_INCREMENT,
  original_issue_id INT NOT NULL,
  wo_material_id INT NOT NULL,
  wo_id INT NOT NULL,
  product_id INT NOT NULL,
  warehouse_id INT NOT NULL,
  lot_id INT NOT NULL,

  quantity DECIMAL(20,4) NOT NULL,
  unit_cost DECIMAL(20,4) NOT NULL,
  total_cost DECIMAL(20,4) NOT NULL,

  cost_layer_id INT NULL,
  cost_allocation_id INT NULL COMMENT 'compensating allocation created by this return',
  movement_id INT NULL,
  journal_entry_id INT NULL,

  reason VARCHAR(255) NULL,
  idempotency_key VARCHAR(100) NOT NULL,
  payload_hash VARCHAR(64) NULL,

  returned_by INT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_return_idempotency (original_issue_id, idempotency_key),
  KEY idx_return_issue (original_issue_id),
  KEY idx_return_wo (wo_id),
  KEY idx_return_lot (lot_id),
  CONSTRAINT fk_return_issue FOREIGN KEY (original_issue_id) REFERENCES wo_material_issues(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
