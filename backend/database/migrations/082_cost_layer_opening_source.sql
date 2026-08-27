-- An opening balance is not an adjustment.
--
-- inventory_cost_layers.source_type allows grn_item, fg_receipt, adjustment and return, so the
-- opening valuation had nowhere honest to sit. Forcing it into 'adjustment' would say the
-- starting position was a correction to something earlier, when there was nothing earlier —
-- and the costing code reads this column to decide what a layer is.
--
-- The table is empty in production, so widening the enum costs nothing today and stops the
-- first opening entry from having to lie about where it came from.
ALTER TABLE inventory_cost_layers
  MODIFY COLUMN source_type ENUM('grn_item','fg_receipt','adjustment','return','opening') NOT NULL;
