-- 054_inventory_cost_layers.sql
-- Phase 4: inventory cost layers, cost allocations, batch cost sheets
-- blueprint §8.8: inventory valuation and manufacturing cost

-- cost layer per receipt lot (GRN, FG receipt, adjustment)
CREATE TABLE IF NOT EXISTS inventory_cost_layers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  lot_id INT NOT NULL,
  product_id INT NOT NULL,
  warehouse_id INT NOT NULL,

  source_type ENUM('grn_item', 'fg_receipt', 'adjustment', 'return') NOT NULL,
  source_document_id INT NOT NULL COMMENT 'grn_id / wo_id / adjustment_id',
  source_line_id INT NULL COMMENT 'grn_item_id / stock_movement_id',

  quantity_received DECIMAL(20,4) NOT NULL,
  quantity_remaining DECIMAL(20,4) NOT NULL,
  quantity_allocated DECIMAL(20,4) NOT NULL DEFAULT 0,

  unit_material_cost DECIMAL(20,4) NOT NULL DEFAULT 0 COMMENT 'PO price or WIP-derived cost',
  unit_landed_cost DECIMAL(20,4) NOT NULL DEFAULT 0 COMMENT 'freight/duties allocated later',
  unit_cost DECIMAL(20,4) NOT NULL DEFAULT 0 COMMENT 'material + landed = total unit cost',
  total_cost DECIMAL(20,4) NOT NULL DEFAULT 0 COMMENT 'unit_cost * quantity_received',

  currency VARCHAR(10) NOT NULL DEFAULT 'IDR',
  exchange_rate DECIMAL(20,10) NOT NULL DEFAULT 1,

  cost_status ENUM('PROVISIONAL', 'FINAL') NOT NULL DEFAULT 'PROVISIONAL',

  journal_entry_id INT NULL COMMENT 'GL journal that created this layer',

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INT NULL,

  KEY idx_lot (lot_id),
  KEY idx_product_wh (product_id, warehouse_id),
  KEY idx_source (source_type, source_document_id),
  KEY idx_cost_status (cost_status),
  KEY idx_journal (journal_entry_id),
  UNIQUE KEY uniq_lot_source (lot_id, source_type, source_line_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- cost allocation per outbound movement (material issue, shipment, adjustment)
CREATE TABLE IF NOT EXISTS inventory_cost_allocations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  cost_layer_id INT NOT NULL,

  movement_type ENUM('wo_material_issue', 'shipment', 'adjustment', 'return', 'scrap') NOT NULL,
  movement_id INT NOT NULL COMMENT 'wo_material_issues.id / stock_movements.id',

  quantity_allocated DECIMAL(20,4) NOT NULL,
  unit_cost DECIMAL(20,4) NOT NULL,
  total_cost DECIMAL(20,4) NOT NULL,

  journal_entry_id INT NULL COMMENT 'GL journal for this consumption',

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  KEY idx_layer (cost_layer_id),
  KEY idx_movement (movement_type, movement_id),
  KEY idx_journal (journal_entry_id),
  CONSTRAINT fk_alloc_layer FOREIGN KEY (cost_layer_id) REFERENCES inventory_cost_layers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- batch cost sheet per WO (accumulates material, labor, overhead into FG cost)
CREATE TABLE IF NOT EXISTS batch_cost_sheets (
  id INT PRIMARY KEY AUTO_INCREMENT,
  wo_id INT NOT NULL,
  -- empty string rather than NULL: a unique key treats NULLs as distinct, so an
  -- unbatched sheet would not be constrained at all
  batch_number VARCHAR(100) NOT NULL DEFAULT '',
  fg_product_id INT NOT NULL,
  fg_lot_id INT NULL COMMENT 'set when FG lot is created',

  material_cost DECIMAL(20,4) NOT NULL DEFAULT 0,
  direct_labor DECIMAL(20,4) NOT NULL DEFAULT 0,
  overhead_absorbed DECIMAL(20,4) NOT NULL DEFAULT 0,
  outside_processing DECIMAL(20,4) NOT NULL DEFAULT 0,
  scrap_cost DECIMAL(20,4) NOT NULL DEFAULT 0,

  total_cost DECIMAL(20,4) NOT NULL DEFAULT 0,
  accepted_output_qty DECIMAL(20,4) NOT NULL DEFAULT 0,

  provisional_unit_cost DECIMAL(20,4) NULL,
  final_unit_cost DECIMAL(20,4) NULL,

  cost_status ENUM('OPEN', 'PROVISIONAL', 'FINAL') NOT NULL DEFAULT 'OPEN',

  version INT NOT NULL DEFAULT 1,
  finalized_at TIMESTAMP NULL,
  finalized_by INT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  KEY idx_wo (wo_id),
  KEY idx_fg_product (fg_product_id),
  KEY idx_status (cost_status),
  UNIQUE KEY uniq_wo_batch (wo_id, batch_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- add unit_cost snapshot to grn_items (freeze PO price at receipt time)
ALTER TABLE grn_items ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(20,4) NULL
  COMMENT 'PO unit_price snapshot at receipt time';
ALTER TABLE grn_items ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NULL DEFAULT 'IDR';
ALTER TABLE grn_items ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(20,10) NULL DEFAULT 1;

-- add journal references to stock_movements for audit trail
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS journal_entry_id INT NULL
  COMMENT 'GL journal entry created by this movement';
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS cost_layer_id INT NULL
  COMMENT 'cost layer created or consumed by this movement';

-- add cost fields to wo_material_issues for quick lookup
ALTER TABLE wo_material_issues ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(20,4) NULL
  COMMENT 'unit cost from allocated cost layer';
ALTER TABLE wo_material_issues ADD COLUMN IF NOT EXISTS total_cost DECIMAL(20,4) NULL;
ALTER TABLE wo_material_issues ADD COLUMN IF NOT EXISTS cost_layer_id INT NULL;
ALTER TABLE wo_material_issues ADD COLUMN IF NOT EXISTS journal_entry_id INT NULL;

-- seed additional account roles for production (if not already present)
INSERT IGNORE INTO account_roles (company_id, role_code, account_id, effective_from)
SELECT 1, 'DIRECT_LABOR_CLEARING', id, '2025-01-01' FROM chart_of_accounts WHERE account_code = '5100'
ON DUPLICATE KEY UPDATE role_code = role_code;

INSERT IGNORE INTO account_roles (company_id, role_code, account_id, effective_from)
SELECT 1, 'OVERHEAD_APPLIED', id, '2025-01-01' FROM chart_of_accounts WHERE account_code = '5200'
ON DUPLICATE KEY UPDATE role_code = role_code;
