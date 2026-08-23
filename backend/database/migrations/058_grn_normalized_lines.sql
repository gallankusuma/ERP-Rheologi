-- Goods receipt lines become a normalized table instead of JSON inside goods_receipts.notes.
--
-- Reading receipt lines out of a free-text notes column means the lines are editable after
-- submission, carry no referential integrity, and cannot be constrained. A client could name
-- any product against any PO line, and two lines pointing at the same PO item each passed the
-- outstanding-quantity check against the same snapshot and then both added quantity.

CREATE TABLE IF NOT EXISTS grn_lines (
  id INT PRIMARY KEY AUTO_INCREMENT,
  grn_id INT NOT NULL,
  po_item_id INT NOT NULL,
  product_id INT NOT NULL COMMENT 'derived from the PO item, never taken from the request',

  quantity_received DECIMAL(20,4) NOT NULL,
  unit_cost DECIMAL(20,4) NOT NULL DEFAULT 0 COMMENT 'PO price snapshot at line freeze',
  currency VARCHAR(10) NOT NULL DEFAULT 'IDR',

  batch_number VARCHAR(100) NULL,
  remarks TEXT NULL,

  frozen_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,

  -- one line per PO item per receipt: this is what makes "6 + 6 against an outstanding 10"
  -- impossible rather than merely unlikely
  UNIQUE KEY uq_grn_line (grn_id, po_item_id),
  KEY idx_grn_lines_grn (grn_id),
  CONSTRAINT fk_grn_lines_grn FOREIGN KEY (grn_id) REFERENCES goods_receipts(id) ON DELETE CASCADE,
  CONSTRAINT fk_grn_lines_po_item FOREIGN KEY (po_item_id) REFERENCES purchase_order_items(id),
  CONSTRAINT fk_grn_lines_product FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- the posted result must not be able to carry two rows for one PO line either
ALTER TABLE grn_items
  ADD UNIQUE INDEX IF NOT EXISTS uq_grn_item_po_line (grn_id, po_item_id);
