-- P1-7: add lot/source identity columns to inventory_stocks
-- these columns make available stock identity explicit rather than relying
-- on nullable grn_id which is only set during qc_hold

ALTER TABLE inventory_stocks ADD COLUMN IF NOT EXISTS batch_number VARCHAR(100) NULL AFTER grn_id;
ALTER TABLE inventory_stocks ADD COLUMN IF NOT EXISTS source_type VARCHAR(50) NULL AFTER batch_number;
ALTER TABLE inventory_stocks ADD COLUMN IF NOT EXISTS source_id INT NULL AFTER source_type;

-- index for looking up stock by source lineage
CREATE INDEX IF NOT EXISTS idx_inv_source ON inventory_stocks(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_inv_batch ON inventory_stocks(batch_number);
