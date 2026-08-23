-- P0-5: Lot tracking schema for inventory_stocks
-- Adds grn_id column and updates unique constraint to include it

-- add grn_id column
ALTER TABLE inventory_stocks ADD COLUMN IF NOT EXISTS grn_id INT NULL AFTER status;

-- add index on grn_id
ALTER TABLE inventory_stocks ADD INDEX IF NOT EXISTS idx_inv_grn_id (grn_id);

-- The unique key migration (warehouse_id, product_id, status) -> (warehouse_id, product_id, status, grn_id)
-- is handled by the runtime ensure in database.ts because MySQL doesn't support
-- COALESCE in unique keys. We use a conditional NULL-safe approach at runtime.

-- P0-5 addendum: add qty and unit columns to bom_headers for batch size tracking
ALTER TABLE bom_headers ADD COLUMN IF NOT EXISTS qty DECIMAL(15,4) NULL;
ALTER TABLE bom_headers ADD COLUMN IF NOT EXISTS unit VARCHAR(50) NULL;
