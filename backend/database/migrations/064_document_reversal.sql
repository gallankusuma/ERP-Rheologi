-- Reversal at the document level.
--
-- The ledger could already reverse a journal: it posts a mirror entry, links the two, and
-- leaves the original untouched. That is correct and stays as it is.
--
-- What was missing is everything the journal does not know about. Reversing the journal of a
-- vendor invoice left the receipt line still marked as billed, the payable still open, and the
-- invoice number still taken. Reversing a shipment left the stock off the shelf and the cost
-- layers still consumed. The books said one thing and the operation said another.
--
-- A reversal is not a return. A return records that goods really came back. A reversal records
-- that a posting should never have existed -- wrong amount, wrong lot, wrong document, posted
-- twice. Neither deletes anything: the original keeps its journal, and the correction is its
-- own entry.

-- ---------------------------------------------------------------------------
-- Reusing a document identifier after reversal
-- ---------------------------------------------------------------------------
--
-- A vendor's invoice number belongs to the vendor. If we post it wrongly and reverse it, the
-- corrected invoice still carries the same number, so the number has to become free again --
-- while the reversed row stays exactly where it is as history.
--
-- The unique key therefore covers a supersession marker as well. A live row carries 0; a
-- reversed row is stamped with its own id, which is unique by construction, so it vacates the
-- live slot without moving and without any risk of colliding with another reversed row.

ALTER TABLE accounts_payable
  ADD COLUMN IF NOT EXISTS superseded_seq INT NOT NULL DEFAULT 0
    COMMENT '0 while live; set to the row id once reversed, freeing the invoice number',
  ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS reversed_by INT NULL,
  ADD COLUMN IF NOT EXISTS reversal_reason TEXT NULL,
  ADD COLUMN IF NOT EXISTS reversal_journal_id INT NULL
    COMMENT 'the mirror journal that undid this liability';

-- The replacement goes in before the old one comes out. The old index is the only one whose
-- leftmost column is vendor_id, so the foreign key to vendors leans on it; dropping it first
-- leaves the constraint with nothing to use and the statement fails.
ALTER TABLE accounts_payable
  ADD UNIQUE INDEX IF NOT EXISTS uq_ap_vendor_invoice_live (vendor_id, invoice_number, superseded_seq);

ALTER TABLE accounts_payable
  DROP INDEX IF EXISTS uq_ap_vendor_invoice;

ALTER TABLE accounts_receivable
  ADD COLUMN IF NOT EXISTS superseded_seq INT NOT NULL DEFAULT 0
    COMMENT '0 while live; set to the row id once reversed, freeing the invoice',
  ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS reversed_by INT NULL,
  ADD COLUMN IF NOT EXISTS reversal_reason TEXT NULL,
  ADD COLUMN IF NOT EXISTS reversal_journal_id INT NULL;

-- same ordering, for the same reason: the invoice foreign key rests on this index
ALTER TABLE accounts_receivable
  ADD UNIQUE INDEX IF NOT EXISTS uq_ar_invoice_live (invoice_id, superseded_seq);

ALTER TABLE accounts_receivable
  DROP INDEX IF EXISTS uq_ar_invoice;

-- ---------------------------------------------------------------------------
-- Shipments
-- ---------------------------------------------------------------------------
--
-- A shipment is claimed by its idempotency key, which is what stops a retry shipping twice.
-- Once reversed, that claim has to be released or the corrected shipment -- a different key,
-- but the same delivery -- has nothing to post against.

ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS reversed_by INT NULL,
  ADD COLUMN IF NOT EXISTS reversal_reason TEXT NULL,
  ADD COLUMN IF NOT EXISTS reversal_journal_id INT NULL;

-- ---------------------------------------------------------------------------
-- Invoice lines
-- ---------------------------------------------------------------------------
--
-- Reversing an invoice hands the billed quantity back to the receipt line, so those invoice
-- lines must stop counting -- both for what may still be billed and for what a debit note may
-- reach. They are marked rather than removed, because they are what the reversal is evidence of.

ALTER TABLE vendor_invoice_lines
  ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMP NULL
    COMMENT 'set when the invoice was reversed; the line no longer counts as billed';

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
--
-- Reversal undoes a posted document and is a heavier authority than creating one, so it is a
-- permission of its own rather than implied by create. It is granted to whoever already holds
-- the ledger's own reversal right, which is the closest existing equivalent.

INSERT IGNORE INTO permissions (resource, action, module, name, description) VALUES
('finance.document-reversal', 'reverse', 'Finance - Document Reversal', 'Reverse Posted Documents',
 'Reverse a posted vendor invoice, customer invoice or shipment, including its operational effect');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, target.id
  FROM role_permissions rp
  JOIN permissions src    ON src.id = rp.permission_id
  JOIN permissions target ON target.resource = 'finance.document-reversal' AND target.action = 'reverse'
 WHERE src.resource = 'finance.general-ledger' AND src.action = 'reverse';
