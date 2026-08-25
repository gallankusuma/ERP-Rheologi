-- Returns on both sides: goods going back to a vendor, and goods coming back from a customer.
--
-- Neither could be recorded at all. Goods physically moved back and nothing in the system
-- said so, which meant stock was wrong, the cost layers were wrong, and the vendor or
-- customer balance stayed at a figure both sides had already stopped agreeing with.
--
-- A return is not a deletion of the original transaction. The receipt happened, the shipment
-- happened, and both keep their journals. The return is its own event with its own posting,
-- so the history stays readable and nothing has to be edited after the fact.

-- ---------------------------------------------------------------------------
-- Purchase returns
-- ---------------------------------------------------------------------------
--
-- Where the value goes depends on whether the goods had been invoiced yet, and that is not a
-- matter of opinion -- the receipt line records exactly how much of it has been billed.
--
--   not yet invoiced   the receipt accrued into GRNI, so the return takes it back out
--   already invoiced   we owe money for goods we no longer have, so a debit note reduces AP

CREATE TABLE IF NOT EXISTS purchase_returns (
  id INT PRIMARY KEY AUTO_INCREMENT,
  return_number VARCHAR(50) NOT NULL,
  vendor_id INT NOT NULL,
  grn_id INT NOT NULL,
  po_id INT NULL,
  warehouse_id INT NOT NULL,
  return_date DATE NOT NULL,
  reason TEXT NULL,

  total_cost DECIMAL(20,4) NOT NULL DEFAULT 0 COMMENT 'inventory value leaving, at cost layer cost',
  grni_amount DECIMAL(20,4) NOT NULL DEFAULT 0 COMMENT 'portion taken back out of GRNI',
  debit_note_amount DECIMAL(20,4) NOT NULL DEFAULT 0 COMMENT 'portion charged back to the vendor',
  price_variance DECIMAL(20,4) NOT NULL DEFAULT 0 COMMENT 'difference between the three, kept visible',

  journal_entry_id INT NULL,
  idempotency_key VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'posted',
  created_by INT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_purchase_return_number (return_number),
  UNIQUE KEY uq_purchase_return_key (idempotency_key),
  KEY idx_purchase_returns_grn (grn_id),
  CONSTRAINT fk_pret_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id),
  CONSTRAINT fk_pret_grn FOREIGN KEY (grn_id) REFERENCES goods_receipts(id),
  CONSTRAINT fk_pret_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS purchase_return_lines (
  id INT PRIMARY KEY AUTO_INCREMENT,
  purchase_return_id INT NOT NULL,
  grn_line_id INT NOT NULL,

  -- read from the receipt line, never from the request
  product_id INT NOT NULL,
  lot_id INT NOT NULL COMMENT 'the exact lot going back',

  quantity DECIMAL(20,4) NOT NULL,
  unit_cost DECIMAL(20,4) NOT NULL COMMENT 'from the cost layer the goods came from',
  total_cost DECIMAL(20,4) NOT NULL,

  uninvoiced_quantity DECIMAL(20,4) NOT NULL DEFAULT 0 COMMENT 'part of this return that clears GRNI',
  invoiced_quantity DECIMAL(20,4) NOT NULL DEFAULT 0 COMMENT 'part that needs a debit note',

  cost_layer_id INT NULL,
  stock_movement_id INT NULL,

  UNIQUE KEY uq_pret_line (purchase_return_id, grn_line_id),
  KEY idx_pret_lines_grn_line (grn_line_id),
  CONSTRAINT fk_pretl_return FOREIGN KEY (purchase_return_id) REFERENCES purchase_returns(id) ON DELETE CASCADE,
  CONSTRAINT fk_pretl_grn_line FOREIGN KEY (grn_line_id) REFERENCES grn_lines(id),
  CONSTRAINT fk_pretl_product FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- One receipt line may have been billed across several invoices, because partial billing is
-- allowed. A debit note therefore has to say which payable each part of it reduces, rather
-- than assuming there is only one.
CREATE TABLE IF NOT EXISTS purchase_return_ap_allocations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  purchase_return_line_id INT NOT NULL,
  ap_id INT NOT NULL,
  vendor_invoice_line_id INT NOT NULL,

  quantity DECIMAL(20,4) NOT NULL,
  unit_price DECIMAL(20,4) NOT NULL COMMENT 'what the vendor charged for it',
  amount DECIMAL(20,4) NOT NULL,

  KEY idx_pret_ap_alloc_ap (ap_id),
  CONSTRAINT fk_pret_alloc_line FOREIGN KEY (purchase_return_line_id) REFERENCES purchase_return_lines(id) ON DELETE CASCADE,
  CONSTRAINT fk_pret_alloc_ap FOREIGN KEY (ap_id) REFERENCES accounts_payable(id),
  CONSTRAINT fk_pret_alloc_vil FOREIGN KEY (vendor_invoice_line_id) REFERENCES vendor_invoice_lines(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- how much of the receipt line has gone back, so a second return cannot send the same goods
-- back twice and so the remaining billable quantity stays honest
--
-- Two totals, not one, because they answer different questions. A return of goods that were
-- never billed removes them from what the vendor may still invoice. A return of goods that
-- were already billed does not -- that money is already owed, and comes back as a debit note
-- instead. Without the split, returning uninvoiced goods would leave the vendor free to
-- invoice them anyway.
ALTER TABLE grn_lines
  ADD COLUMN IF NOT EXISTS quantity_returned DECIMAL(20,4) NOT NULL DEFAULT 0
    COMMENT 'returned to the vendor so far',
  ADD COLUMN IF NOT EXISTS quantity_returned_billed DECIMAL(20,4) NOT NULL DEFAULT 0
    COMMENT 'the part of quantity_returned that had already been invoiced';

-- what a debit note has taken off this payable
ALTER TABLE accounts_payable
  ADD COLUMN IF NOT EXISTS debit_note_amount DECIMAL(20,4) NOT NULL DEFAULT 0
    COMMENT 'reduced by purchase returns; the vendor owes us this back';

-- ---------------------------------------------------------------------------
-- Sales returns
-- ---------------------------------------------------------------------------
--
-- Goods come back from a customer. Two things happen, and they are independent:
--
--   the goods    if they can be resold they go back into their original lot and the cost
--                comes back out of COGS; if they cannot, the cost stays where it is,
--                because the goods really are gone
--   the money    a credit note reverses the revenue and the tax, and reduces the receivable

CREATE TABLE IF NOT EXISTS sales_returns (
  id INT PRIMARY KEY AUTO_INCREMENT,
  return_number VARCHAR(50) NOT NULL,
  customer_id INT NOT NULL,
  delivery_id INT NOT NULL,
  so_id INT NULL,
  invoice_id INT NULL,
  ar_id INT NULL COMMENT 'receivable the credit note reduces, when the sale was invoiced',
  warehouse_id INT NOT NULL,
  return_date DATE NOT NULL,
  reason TEXT NULL,

  cogs_reversed DECIMAL(20,4) NOT NULL DEFAULT 0 COMMENT 'cost of the goods actually restocked',
  credit_note_net DECIMAL(20,4) NOT NULL DEFAULT 0,
  credit_note_tax DECIMAL(20,4) NOT NULL DEFAULT 0,
  credit_note_gross DECIMAL(20,4) NOT NULL DEFAULT 0,

  journal_entry_id INT NULL,
  idempotency_key VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'posted',
  created_by INT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_sales_return_number (return_number),
  UNIQUE KEY uq_sales_return_key (idempotency_key),
  KEY idx_sales_returns_delivery (delivery_id),
  CONSTRAINT fk_sret_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_sret_delivery FOREIGN KEY (delivery_id) REFERENCES deliveries(id),
  CONSTRAINT fk_sret_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sales_return_lines (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sales_return_id INT NOT NULL,
  delivery_item_id INT NOT NULL,

  -- read from the delivery line, never from the request
  product_id INT NOT NULL,
  lot_id INT NOT NULL COMMENT 'the exact lot that went out, and comes back',

  quantity DECIMAL(20,4) NOT NULL,
  restocked TINYINT(1) NOT NULL DEFAULT 1
    COMMENT 'goods fit to sell again go back into stock; damaged goods do not',

  unit_cost DECIMAL(20,4) NOT NULL COMMENT 'what it cost us, from the original shipment',
  total_cost DECIMAL(20,4) NOT NULL,
  unit_price DECIMAL(20,4) NOT NULL DEFAULT 0 COMMENT 'what we charged, for the credit note',
  line_net DECIMAL(20,4) NOT NULL DEFAULT 0,

  cost_layer_id INT NULL,
  stock_movement_id INT NULL,

  UNIQUE KEY uq_sret_line (sales_return_id, delivery_item_id),
  KEY idx_sret_lines_delivery_item (delivery_item_id),
  CONSTRAINT fk_sretl_return FOREIGN KEY (sales_return_id) REFERENCES sales_returns(id) ON DELETE CASCADE,
  CONSTRAINT fk_sretl_delivery_item FOREIGN KEY (delivery_item_id) REFERENCES delivery_items(id),
  CONSTRAINT fk_sretl_product FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- so the same delivered goods cannot come back twice
ALTER TABLE delivery_items
  ADD COLUMN IF NOT EXISTS quantity_returned DECIMAL(20,4) NOT NULL DEFAULT 0
    COMMENT 'returned by the customer so far';

-- what a credit note has taken off this receivable
ALTER TABLE accounts_receivable
  ADD COLUMN IF NOT EXISTS credit_note_amount DECIMAL(20,4) NOT NULL DEFAULT 0
    COMMENT 'reduced by sales returns; we owe the customer this back';

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
--
-- A return moves goods and money in opposite directions and reduces what a vendor or customer
-- owes, so it is its own authority rather than a side effect of receiving or delivering.
-- Each new permission is granted to exactly the roles that already hold the equivalent one,
-- so nobody gains reach they did not already have.

INSERT IGNORE INTO permissions (resource, action, module, name, description) VALUES
('procurement.purchase-returns', 'view', 'Procurement - Purchase Returns', 'Purchase Returns View', 'View goods returned to vendors'),
('procurement.purchase-returns', 'create', 'Procurement - Purchase Returns', 'Purchase Returns Create', 'Return goods to a vendor and raise a debit note'),
('crm.sales-returns', 'view', 'CRM - Sales Returns', 'Sales Returns View', 'View goods returned by customers'),
('crm.sales-returns', 'create', 'CRM - Sales Returns', 'Sales Returns Create', 'Accept returned goods and raise a credit note');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, target.id
  FROM role_permissions rp
  JOIN permissions src    ON src.id = rp.permission_id
  JOIN permissions target ON target.resource = 'procurement.purchase-returns' AND target.action = 'view'
 WHERE src.resource = 'procurement.grn' AND src.action = 'view';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, target.id
  FROM role_permissions rp
  JOIN permissions src    ON src.id = rp.permission_id
  JOIN permissions target ON target.resource = 'procurement.purchase-returns' AND target.action = 'create'
 WHERE src.resource = 'procurement.grn' AND src.action = 'create';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, target.id
  FROM role_permissions rp
  JOIN permissions src    ON src.id = rp.permission_id
  JOIN permissions target ON target.resource = 'crm.sales-returns' AND target.action = 'view'
 WHERE src.resource = 'crm.sales' AND src.action = 'view';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, target.id
  FROM role_permissions rp
  JOIN permissions src    ON src.id = rp.permission_id
  JOIN permissions target ON target.resource = 'crm.sales-returns' AND target.action = 'create'
 WHERE src.resource = 'crm.sales' AND src.action = 'create';
