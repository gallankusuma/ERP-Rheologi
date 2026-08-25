-- Three-way match: the purchase order, the goods receipt and the vendor invoice must agree
-- before a payable is recognised.
--
-- Until now a vendor invoice was believed exactly as sent. Nothing compared it to what was
-- ordered or what actually arrived, so a vendor could bill for quantities never delivered,
-- at prices never agreed, or bill the same receipt twice, and the system would post all of
-- it. That is the control every purchasing cycle is supposed to have.
--
-- It also fixes a quieter defect. The invoice posting debited GRNI by the invoice amount,
-- but GRNI was credited at goods receipt by the PO price. Whenever the two differed the
-- difference stayed in GRNI permanently, so the account drifted further from reality with
-- every price change and could never be reconciled. GRNI must be cleared by exactly what
-- was accrued into it; the difference belongs in purchase price variance, where it can be
-- seen and explained.

CREATE TABLE IF NOT EXISTS vendor_invoice_lines (
  id INT PRIMARY KEY AUTO_INCREMENT,
  ap_id INT NOT NULL,
  grn_line_id INT NOT NULL,

  -- both derived from the receipt line, never accepted from the request: an invoice cannot
  -- name a product or a PO line other than the one actually received
  po_item_id INT NOT NULL,
  product_id INT NOT NULL,

  quantity_invoiced DECIMAL(20,4) NOT NULL,
  unit_price DECIMAL(20,4) NOT NULL COMMENT 'what the vendor is charging',
  received_unit_cost DECIMAL(20,4) NOT NULL COMMENT 'PO price the receipt accrued into GRNI',

  line_amount DECIMAL(20,4) NOT NULL COMMENT 'quantity x vendor price: what is owed',
  grni_amount DECIMAL(20,4) NOT NULL COMMENT 'quantity x receipt cost: what GRNI holds',
  price_variance DECIMAL(20,4) NOT NULL DEFAULT 0 COMMENT 'line_amount - grni_amount',

  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,

  -- one invoice may bill a given receipt line only once; billing it again means a second
  -- invoice, which the running quantity_invoiced total then has to justify
  UNIQUE KEY uq_vendor_invoice_line (ap_id, grn_line_id),
  KEY idx_vil_grn_line (grn_line_id),
  CONSTRAINT fk_vil_ap FOREIGN KEY (ap_id) REFERENCES accounts_payable(id) ON DELETE CASCADE,
  CONSTRAINT fk_vil_grn_line FOREIGN KEY (grn_line_id) REFERENCES grn_lines(id),
  CONSTRAINT fk_vil_po_item FOREIGN KEY (po_item_id) REFERENCES purchase_order_items(id),
  CONSTRAINT fk_vil_product FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- how much of each receipt line has been billed so far. Held on the line itself and updated
-- under the same lock as the check, so two invoices racing the same receipt cannot both pass
-- against the same snapshot.
ALTER TABLE grn_lines
  ADD COLUMN IF NOT EXISTS quantity_invoiced DECIMAL(20,4) NOT NULL DEFAULT 0
    COMMENT 'billed against this receipt line so far; may never exceed quantity_received';

-- what the match concluded, kept on the payable so an unmatched liability is visible rather
-- than indistinguishable from a checked one
ALTER TABLE accounts_payable
  ADD COLUMN IF NOT EXISTS match_status VARCHAR(20) NOT NULL DEFAULT 'unmatched'
    COMMENT 'matched | variance_approved | unmatched (no receipt lines given)',
  ADD COLUMN IF NOT EXISTS price_variance DECIMAL(20,4) NOT NULL DEFAULT 0
    COMMENT 'total difference between invoiced and accrued cost',
  ADD COLUMN IF NOT EXISTS variance_approved_by INT NULL
    COMMENT 'who accepted a variance beyond tolerance',
  ADD COLUMN IF NOT EXISTS variance_reason TEXT NULL
    COMMENT 'why the variance was accepted';

-- Tolerance. Small differences are ordinary commercial life -- rounding, freight, a minor
-- price revision -- and posting them to variance automatically is correct. Anything larger
-- is a question for a person, so it is refused until someone accepts it on the record.
ALTER TABLE accounting_settings
  ADD COLUMN IF NOT EXISTS price_tolerance_percent DECIMAL(9,4) NOT NULL DEFAULT 0
    COMMENT 'per-line variance tolerated as a share of the accrued cost',
  ADD COLUMN IF NOT EXISTS price_tolerance_absolute DECIMAL(20,4) NOT NULL DEFAULT 0
    COMMENT 'per-line variance tolerated outright, whichever is larger';

-- A starting position that accepts the rounding a percentage price inevitably produces
-- without waving through a real price change. Finance can widen or close it.
UPDATE accounting_settings
   SET price_tolerance_percent = 1.0000,
       price_tolerance_absolute = 1000.0000
 WHERE price_tolerance_percent = 0 AND price_tolerance_absolute = 0;
