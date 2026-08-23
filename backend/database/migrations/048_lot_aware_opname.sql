-- Phase 4: lot-aware stock opname items
-- adds lot_id, inventory_stock_id, status_snapshot, batch_number, expiry_date to stock_opname_items
-- adds cutoff_at and state machine status to stock_opname

ALTER TABLE stock_opname
  ADD COLUMN IF NOT EXISTS cutoff_at DATETIME NULL COMMENT 'freeze timestamp for count finalization';

ALTER TABLE stock_opname
  MODIFY COLUMN status VARCHAR(20) NOT NULL DEFAULT 'draft'
  COMMENT 'DRAFT -> COUNTING -> COUNTED -> POSTED';

ALTER TABLE stock_opname_items
  ADD COLUMN IF NOT EXISTS lot_id INT NULL AFTER product_id;

ALTER TABLE stock_opname_items
  ADD COLUMN IF NOT EXISTS inventory_stock_id INT NULL AFTER lot_id;

ALTER TABLE stock_opname_items
  ADD COLUMN IF NOT EXISTS status_snapshot VARCHAR(20) NULL
  COMMENT 'inventory_stocks.status at snapshot time' AFTER system_qty;

ALTER TABLE stock_opname_items
  ADD COLUMN IF NOT EXISTS batch_number VARCHAR(100) NULL AFTER status_snapshot;

ALTER TABLE stock_opname_items
  ADD COLUMN IF NOT EXISTS expiry_date DATE NULL AFTER batch_number;

ALTER TABLE stock_opname_items
  ADD COLUMN IF NOT EXISTS counted_by INT NULL AFTER actual_qty;

ALTER TABLE stock_opname_items
  ADD COLUMN IF NOT EXISTS counted_at DATETIME NULL AFTER counted_by;
