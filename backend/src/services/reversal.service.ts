import { dbTransaction } from '../config/database';
import { reverseJournal } from './accounting-posting.service';
import { restoreCostToLayer } from './inventory-costing.service';
import { money, moneyRound, qtyRound, toDbString } from '../lib/decimal';

// Document reversal.
//
// The ledger could already reverse a journal: it posts a mirror entry, links the two, and
// leaves the original untouched. What it cannot do is know what else the document did.
// Reversing the journal of a vendor invoice left the receipt line still marked as billed, the
// payable still open and the invoice number still taken; reversing a shipment left the stock
// off the shelf and its cost layers still consumed. The books said one thing and the operation
// said another.
//
// A reversal is not a return. A return records that goods really came back, and both events
// are true. A reversal records that a posting should never have existed -- wrong amount, wrong
// lot, wrong document, posted twice. Neither deletes anything.
//
// Nothing here reverses a document that something downstream has already relied on. A payment,
// a debit note, a receipt or a customer return all mean somebody has since acted on the figure,
// and unwinding it silently underneath them would be worse than refusing.

export type ReversalErrorCode =
  | 'AP_NOT_FOUND'
  | 'AR_NOT_FOUND'
  | 'DELIVERY_NOT_FOUND'
  | 'NOT_POSTED'
  | 'ALREADY_REVERSED'
  | 'REVERSAL_BLOCKED'
  | 'MISSING_REVERSAL_REASON';

const STATUS: Record<ReversalErrorCode, number> = {
  AP_NOT_FOUND: 404,
  AR_NOT_FOUND: 404,
  DELIVERY_NOT_FOUND: 404,
  NOT_POSTED: 409,
  ALREADY_REVERSED: 409,
  REVERSAL_BLOCKED: 409,
  MISSING_REVERSAL_REASON: 422,
};

export class ReversalError extends Error {
  public readonly code: ReversalErrorCode;
  public readonly httpStatus: number;
  public readonly data?: Record<string, unknown>;

  constructor(code: ReversalErrorCode, message: string, data?: Record<string, unknown>) {
    super(message);
    this.name = 'ReversalError';
    this.code = code;
    this.httpStatus = STATUS[code];
    this.data = data;
  }
}

export interface DocumentReversalInput {
  reason: string;
  idempotencyKey: string;
  userId: number;
}

function assertReason(reason: string) {
  if (!reason || reason.trim().length < 5) {
    throw new ReversalError(
      'MISSING_REVERSAL_REASON',
      'A reversal has to say why. Undoing a posted document without a reason leaves no trail of what was wrong.'
    );
  }
}

// ---------------------------------------------------------------------------
// Vendor invoice
// ---------------------------------------------------------------------------

export interface VendorInvoiceReversalInput extends DocumentReversalInput {
  apId: number;
}

/**
 * Undo a vendor invoice that should not have been posted.
 *
 * The receipt line gets its billed quantity back, so the corrected invoice can be matched
 * against it again, and the invoice number becomes free -- the vendor's number belongs to the
 * vendor, and the corrected invoice still carries it.
 */
export async function reverseVendorInvoice(input: VendorInvoiceReversalInput): Promise<any> {
  assertReason(input.reason);
  if (!input.idempotencyKey) {
    throw new ReversalError('MISSING_REVERSAL_REASON', 'A reversal requires an idempotency key.');
  }

  return dbTransaction(async (conn: any) => {
    const [rows] = await conn.execute(
      `SELECT id, vendor_id, invoice_number, amount, journal_entry_id, superseded_seq,
              COALESCE(paid_amount, 0) AS paid_amount,
              COALESCE(debit_note_amount, 0) AS debit_note_amount
         FROM accounts_payable WHERE id = ? FOR UPDATE`,
      [input.apId]
    );
    const ap = (rows as any[])[0];
    if (!ap) throw new ReversalError('AP_NOT_FOUND', `Payable ${input.apId} not found.`);

    if (Number(ap.superseded_seq) !== 0) {
      throw new ReversalError('ALREADY_REVERSED', `Payable ${input.apId} has already been reversed.`, {
        apId: input.apId,
      });
    }
    if (!ap.journal_entry_id) {
      throw new ReversalError('NOT_POSTED', `Payable ${input.apId} carries no journal, so there is nothing to reverse.`);
    }

    // somebody has already acted on this figure
    if (money(String(ap.paid_amount)).greaterThan(0)) {
      throw new ReversalError(
        'REVERSAL_BLOCKED',
        `Payable ${input.apId} has ${ap.paid_amount} paid against it. Reverse the payment first, or the money moves ` +
          'without anything on the ledger explaining where it went.',
        { apId: input.apId, paidAmount: String(ap.paid_amount) }
      );
    }
    if (money(String(ap.debit_note_amount)).greaterThan(0)) {
      throw new ReversalError(
        'REVERSAL_BLOCKED',
        `Payable ${input.apId} has a debit note of ${ap.debit_note_amount} against it from a purchase return. ` +
          'The return has to be dealt with before the invoice it was raised against can be undone.',
        { apId: input.apId, debitNoteAmount: String(ap.debit_note_amount) }
      );
    }

    const reversal = await reverseJournal(conn, {
      journalId: Number(ap.journal_entry_id),
      userId: input.userId,
      idempotencyKey: `ap-reversal-${input.idempotencyKey}`,
      reason: input.reason,
    });

    // hand the billed quantity back to the receipt lines it was taken from
    const [lines] = await conn.execute(
      'SELECT id, grn_line_id, quantity_invoiced FROM vendor_invoice_lines WHERE ap_id = ? AND reversed_at IS NULL FOR UPDATE',
      [input.apId]
    );
    for (const line of lines as any[]) {
      await conn.execute(
        'UPDATE grn_lines SET quantity_invoiced = GREATEST(COALESCE(quantity_invoiced, 0) - ?, 0) WHERE id = ?',
        [toDbString(qtyRound(money(String(line.quantity_invoiced))), 4), line.grn_line_id]
      );
    }
    // kept as evidence, but no longer counted as billed
    await conn.execute('UPDATE vendor_invoice_lines SET reversed_at = NOW() WHERE ap_id = ? AND reversed_at IS NULL', [
      input.apId,
    ]);

    // stamping the row with its own id vacates the live invoice-number slot without moving it
    await conn.execute(
      `UPDATE accounts_payable
          SET status = 'reversed', superseded_seq = id, reversed_at = NOW(), reversed_by = ?,
              reversal_reason = ?, reversal_journal_id = ?
        WHERE id = ?`,
      [input.userId, input.reason, reversal.reversal_journal_id, input.apId]
    );

    return {
      ap_id: input.apId,
      invoice_number: ap.invoice_number,
      original_journal_id: Number(ap.journal_entry_id),
      reversal_journal_id: reversal.reversal_journal_id,
      lines_released: (lines as any[]).length,
      invoice_number_released: true,
    };
  });
}

// ---------------------------------------------------------------------------
// Customer invoice
// ---------------------------------------------------------------------------

export interface CustomerInvoiceReversalInput extends DocumentReversalInput {
  invoiceId: number;
}

/**
 * Undo a customer invoice that should not have been posted, freeing the invoice to be raised
 * again once it is right.
 */
export async function reverseCustomerInvoice(input: CustomerInvoiceReversalInput): Promise<any> {
  assertReason(input.reason);
  if (!input.idempotencyKey) {
    throw new ReversalError('MISSING_REVERSAL_REASON', 'A reversal requires an idempotency key.');
  }

  return dbTransaction(async (conn: any) => {
    const [rows] = await conn.execute(
      `SELECT id, invoice_id, customer_id, amount, journal_entry_id, superseded_seq,
              COALESCE(paid_amount, 0) AS paid_amount,
              COALESCE(credit_note_amount, 0) AS credit_note_amount
         FROM accounts_receivable WHERE invoice_id = ? AND superseded_seq = 0 FOR UPDATE`,
      [input.invoiceId]
    );
    const ar = (rows as any[])[0];
    if (!ar) {
      throw new ReversalError('AR_NOT_FOUND', `No live receivable exists for invoice ${input.invoiceId}.`, {
        invoiceId: input.invoiceId,
      });
    }
    if (!ar.journal_entry_id) {
      throw new ReversalError('NOT_POSTED', `Invoice ${input.invoiceId} carries no journal, so there is nothing to reverse.`);
    }

    if (money(String(ar.paid_amount)).greaterThan(0)) {
      throw new ReversalError(
        'REVERSAL_BLOCKED',
        `Invoice ${input.invoiceId} has ${ar.paid_amount} received against it. Money already collected cannot be ` +
          'undone by reversing the invoice that explains it.',
        { invoiceId: input.invoiceId, paidAmount: String(ar.paid_amount) }
      );
    }
    if (money(String(ar.credit_note_amount)).greaterThan(0)) {
      throw new ReversalError(
        'REVERSAL_BLOCKED',
        `Invoice ${input.invoiceId} has a credit note of ${ar.credit_note_amount} against it from a sales return.`,
        { invoiceId: input.invoiceId, creditNoteAmount: String(ar.credit_note_amount) }
      );
    }

    const reversal = await reverseJournal(conn, {
      journalId: Number(ar.journal_entry_id),
      userId: input.userId,
      idempotencyKey: `ar-reversal-${input.idempotencyKey}`,
      reason: input.reason,
    });

    await conn.execute(
      `UPDATE accounts_receivable
          SET status = 'reversed', superseded_seq = id, reversed_at = NOW(), reversed_by = ?,
              reversal_reason = ?, reversal_journal_id = ?
        WHERE id = ?`,
      [input.userId, input.reason, reversal.reversal_journal_id, ar.id]
    );
    await conn.execute('UPDATE invoices SET posted_at = NULL WHERE id = ?', [input.invoiceId]);

    return {
      ar_id: Number(ar.id),
      invoice_id: input.invoiceId,
      original_journal_id: Number(ar.journal_entry_id),
      reversal_journal_id: reversal.reversal_journal_id,
      invoice_released: true,
    };
  });
}

// ---------------------------------------------------------------------------
// Shipment
// ---------------------------------------------------------------------------

export interface ShipmentReversalInput extends DocumentReversalInput {
  deliveryId: number;
}

/**
 * Undo a shipment that should not have been posted -- the wrong lot, the wrong quantity, or
 * posted twice.
 *
 * Unlike a sales return, the goods never left: the record was wrong, not the warehouse. So the
 * stock goes back into the lot it was taken from at the cost it was taken at, and the cost of
 * sales it created is mirrored away.
 */
export async function reverseShipment(input: ShipmentReversalInput): Promise<any> {
  assertReason(input.reason);
  if (!input.idempotencyKey) {
    throw new ReversalError('MISSING_REVERSAL_REASON', 'A reversal requires an idempotency key.');
  }

  return dbTransaction(async (conn: any) => {
    const [rows] = await conn.execute(
      'SELECT id, do_number, posted_at, journal_entry_id, reversed_at, warehouse_id FROM deliveries WHERE id = ? FOR UPDATE',
      [input.deliveryId]
    );
    const delivery = (rows as any[])[0];
    if (!delivery) throw new ReversalError('DELIVERY_NOT_FOUND', `Delivery ${input.deliveryId} not found.`);
    if (delivery.reversed_at) {
      throw new ReversalError('ALREADY_REVERSED', `Delivery ${input.deliveryId} has already been reversed.`);
    }
    if (!delivery.posted_at) {
      throw new ReversalError('NOT_POSTED', `Delivery ${input.deliveryId} has not been posted, so there is nothing to reverse.`);
    }

    const [items] = await conn.execute(
      `SELECT id, product_id, lot_id, quantity_delivered, unit_cost, cost_layer_id, warehouse_id,
              COALESCE(quantity_returned, 0) AS quantity_returned
         FROM delivery_items WHERE delivery_id = ? ORDER BY id ASC FOR UPDATE`,
      [input.deliveryId]
    );

    // a customer return against this shipment means the goods genuinely moved
    const returned = (items as any[]).filter(i => money(String(i.quantity_returned)).greaterThan(0));
    if (returned.length > 0) {
      throw new ReversalError(
        'REVERSAL_BLOCKED',
        `Delivery ${input.deliveryId} has ${returned.length} line(s) the customer has already returned against. ` +
          'A shipment that was returned from really happened; it cannot be unposted as a mistake.',
        { deliveryId: input.deliveryId, returnedLines: returned.map(i => i.id) }
      );
    }

    let restored = money('0');

    for (const item of items as any[]) {
      const qty = qtyRound(money(String(item.quantity_delivered)));
      if (qty.lessThanOrEqualTo(0)) continue;

      const warehouseId = item.warehouse_id || delivery.warehouse_id;

      const [movement] = await conn.execute(
        `INSERT INTO stock_movements
         (warehouse_id, product_id, movement_type, quantity, reference_type, reference_id, lot_id, notes, created_by)
         VALUES (?, ?, 'in', ?, 'shipment_reversal', ?, ?, ?, ?)`,
        [
          warehouseId, item.product_id, toDbString(qty, 4), input.deliveryId, item.lot_id,
          `Reversal of shipment ${delivery.do_number || input.deliveryId}`, input.userId,
        ]
      );

      if (item.cost_layer_id) {
        const restore = await restoreCostToLayer(conn, {
          costLayerId: Number(item.cost_layer_id),
          quantity: toDbString(qty, 4),
          movementType: 'return',
          movementId: movement.insertId,
        });
        restored = restored.plus(money(restore.totalCost));
      }

      const [stockRows] = await conn.execute(
        `SELECT id FROM inventory_stocks
          WHERE lot_id = ? AND warehouse_id = ? AND product_id = ? AND status = 'available'
          ORDER BY id ASC FOR UPDATE`,
        [item.lot_id, warehouseId, item.product_id]
      );
      if ((stockRows as any[]).length > 0) {
        await conn.execute(
          'UPDATE inventory_stocks SET quantity = quantity + ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?',
          [toDbString(qty, 4), (stockRows as any[])[0].id]
        );
      } else {
        await conn.execute(
          `INSERT INTO inventory_stocks (warehouse_id, product_id, quantity, status, lot_id)
           VALUES (?, ?, ?, 'available', ?)`,
          [warehouseId, item.product_id, toDbString(qty, 4), item.lot_id]
        );
      }
    }

    let reversalJournalId: number | null = null;
    if (delivery.journal_entry_id) {
      const reversal = await reverseJournal(conn, {
        journalId: Number(delivery.journal_entry_id),
        userId: input.userId,
        idempotencyKey: `shipment-reversal-${input.idempotencyKey}`,
        reason: input.reason,
      });
      reversalJournalId = reversal.reversal_journal_id;
    }

    // the delivery lines described a shipment that did not happen
    await conn.execute('UPDATE delivery_items SET quantity_delivered = 0 WHERE delivery_id = ?', [input.deliveryId]);

    // releasing posted_at and the idempotency claim is what lets a corrected shipment post
    await conn.execute(
      `UPDATE deliveries
          SET status = 'draft', posted_at = NULL, idempotency_key = NULL,
              reversed_at = NOW(), reversed_by = ?, reversal_reason = ?, reversal_journal_id = ?
        WHERE id = ?`,
      [input.userId, input.reason, reversalJournalId, input.deliveryId]
    );

    return {
      delivery_id: input.deliveryId,
      original_journal_id: delivery.journal_entry_id ? Number(delivery.journal_entry_id) : null,
      reversal_journal_id: reversalJournalId,
      cost_restored: toDbString(moneyRound(restored)),
      lines_reversed: (items as any[]).length,
      delivery_released: true,
    };
  });
}
