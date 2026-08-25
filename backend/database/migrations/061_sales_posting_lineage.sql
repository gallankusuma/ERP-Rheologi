-- Lineage for the sales side of the ledger.
--
-- Shipment relieves finished goods and creates cost of goods sold; invoicing recognises
-- revenue and a receivable; a receipt turns that receivable into cash. None of it was
-- recorded: a delivery was a header with no lines, no stock effect and no journal, and an
-- invoice was a total with no receivable behind it.

-- delivery lines carry the exact lot that left, and what it cost
ALTER TABLE delivery_items
  ADD COLUMN IF NOT EXISTS lot_id INT NULL COMMENT 'exact lot shipped',
  ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(20,4) NULL COMMENT 'from the lot cost layer',
  ADD COLUMN IF NOT EXISTS total_cost DECIMAL(20,4) NULL,
  ADD COLUMN IF NOT EXISTS cost_layer_id INT NULL,
  ADD COLUMN IF NOT EXISTS stock_movement_id INT NULL,
  ADD COLUMN IF NOT EXISTS warehouse_id INT NULL;

-- warehouse_id and shipped_at were written by the create-delivery endpoint but never existed
-- on the table, so creating a delivery failed outright. delivery_date is NOT NULL with no
-- default, which is why the insert had to be given one.
ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS warehouse_id INT NULL COMMENT 'warehouse the goods ship from',
  ADD COLUMN IF NOT EXISTS shipped_at DATE NULL,
  ADD COLUMN IF NOT EXISTS customer_id INT NULL,
  ADD COLUMN IF NOT EXISTS journal_entry_id INT NULL COMMENT 'Dr COGS, Cr finished goods',
  ADD COLUMN IF NOT EXISTS posted_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100) NULL;

ALTER TABLE deliveries
  ADD UNIQUE INDEX IF NOT EXISTS uq_delivery_idempotency (idempotency_key);

-- a receivable belongs to the invoice that raised it
ALTER TABLE accounts_receivable
  ADD COLUMN IF NOT EXISTS so_id INT NULL,
  ADD COLUMN IF NOT EXISTS journal_entry_id INT NULL COMMENT 'Dr AR, Cr revenue',
  ADD COLUMN IF NOT EXISTS posted_at TIMESTAMP NULL;

ALTER TABLE accounts_receivable
  ADD UNIQUE INDEX IF NOT EXISTS uq_ar_invoice (invoice_id);

-- a receipt is a row, not an increment: a retry must settle once and carry its own journal
ALTER TABLE sales_payments
  ADD COLUMN IF NOT EXISTS journal_entry_id INT NULL,
  ADD COLUMN IF NOT EXISTS receipt_account_role VARCHAR(50) NOT NULL DEFAULT 'BANK_OPERATING',
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100) NULL;

ALTER TABLE sales_payments
  ADD UNIQUE INDEX IF NOT EXISTS uq_sales_payment_key (invoice_id, idempotency_key);

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS customer_id INT NULL,
  ADD COLUMN IF NOT EXISTS posted_at TIMESTAMP NULL;
