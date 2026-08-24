-- Accounts payable gets journal lineage and individual payment records.
--
-- GRNI was credited at goods receipt and never cleared, because nothing posted the vendor
-- invoice that turns "goods received, not invoiced" into a real liability. Payments only
-- moved a running paid_amount, so there was no record of an individual payment, no way to
-- make a retry idempotent, and nothing linking a payment to its journal.

ALTER TABLE accounts_payable
  ADD COLUMN IF NOT EXISTS journal_entry_id INT NULL
    COMMENT 'journal that recognised this liability (Dr GRNI, Cr AP)',
  ADD COLUMN IF NOT EXISTS grn_id INT NULL
    COMMENT 'receipt this invoice settles, when known',
  ADD COLUMN IF NOT EXISTS posted_at TIMESTAMP NULL
    COMMENT 'when the liability was recognised in the ledger';

CREATE TABLE IF NOT EXISTS ap_payments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  ap_id INT NOT NULL,
  vendor_id INT NULL,

  amount DECIMAL(20,4) NOT NULL,
  payment_date DATE NOT NULL,
  payment_account_role VARCHAR(50) NOT NULL DEFAULT 'BANK_OPERATING'
    COMMENT 'which cash or bank account funded this payment',
  reference VARCHAR(100) NULL COMMENT 'transfer or cheque reference',

  journal_entry_id INT NULL,
  idempotency_key VARCHAR(100) NOT NULL,

  paid_by INT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,

  -- a retried payment must settle once, not twice
  UNIQUE KEY uq_ap_payment_key (ap_id, idempotency_key),
  KEY idx_ap_payments_ap (ap_id),
  CONSTRAINT fk_ap_payment_ap FOREIGN KEY (ap_id) REFERENCES accounts_payable(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- an invoice number is the vendor's identifier for one liability; the same number from the
-- same vendor must not create a second payable
ALTER TABLE accounts_payable
  ADD UNIQUE INDEX IF NOT EXISTS uq_ap_vendor_invoice (vendor_id, invoice_number);
