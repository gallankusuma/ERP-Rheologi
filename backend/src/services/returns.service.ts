import { dbTransaction } from '../config/database';
import { postSystemJournal, JournalLineInput } from './accounting-posting.service';
import { resolveAccountByRole } from './account-role.service';
import { allocateCostFromLayer, restoreCostToLayer } from './inventory-costing.service';
import { money, moneyRound, qtyRound, toDbString } from '../lib/decimal';

// Returns, on both sides.
//
// Neither could be recorded at all. Goods physically moved back and nothing said so, which
// left the stock wrong, the cost layers wrong, and the vendor or customer balance stuck at a
// figure both sides had already stopped agreeing with.
//
// A return is not the deletion of the original transaction. The receipt happened and the
// shipment happened; both keep their journals. The return is its own event with its own
// posting, so nothing has to be edited after the fact and the history stays readable.
//
// Purchase return -- where the value goes depends on whether the goods were invoiced yet,
// and the receipt line already records exactly how much of it has been billed:
//
//   not yet invoiced   Dr GRNI              Cr Inventory     (undo the accrual)
//   already invoiced   Dr Accounts Payable  Cr Inventory     (a debit note; we owe less)
//
// Sales return -- two independent things happen:
//
//   the goods    Dr Finished Goods   Cr COGS     but only if they can be sold again
//   the money    Dr Revenue + tax    Cr AR       a credit note against the receivable

export type ReturnsErrorCode =
  | 'GRN_LINE_NOT_FOUND'
  | 'DELIVERY_ITEM_NOT_FOUND'
  | 'DELIVERY_NOT_FOUND'
  | 'VENDOR_MISMATCH'
  | 'INVALID_LINE'
  | 'OVER_RETURN_QUANTITY'
  | 'INSUFFICIENT_STOCK'
  | 'RETURN_ALREADY_PAID'
  | 'AR_NOT_FOUND'
  | 'CREDIT_NOTE_EXCEEDS_RECEIVABLE';

const STATUS: Record<ReturnsErrorCode, number> = {
  GRN_LINE_NOT_FOUND: 404,
  DELIVERY_ITEM_NOT_FOUND: 404,
  DELIVERY_NOT_FOUND: 404,
  VENDOR_MISMATCH: 409,
  INVALID_LINE: 422,
  OVER_RETURN_QUANTITY: 409,
  INSUFFICIENT_STOCK: 409,
  RETURN_ALREADY_PAID: 409,
  AR_NOT_FOUND: 404,
  CREDIT_NOTE_EXCEEDS_RECEIVABLE: 409,
};

export class ReturnsError extends Error {
  public readonly code: ReturnsErrorCode;
  public readonly httpStatus: number;
  public readonly data?: Record<string, unknown>;

  constructor(code: ReturnsErrorCode, message: string, data?: Record<string, unknown>) {
    super(message);
    this.name = 'ReturnsError';
    this.code = code;
    this.httpStatus = STATUS[code];
    this.data = data;
  }
}

function assertNoDuplicates(ids: number[], what: string) {
  const seen = new Set<number>();
  for (const id of ids) {
    if (seen.has(id)) {
      throw new ReturnsError('INVALID_LINE', `${what} ${id} appears twice on the same return.`, { id });
    }
    seen.add(id);
  }
}

// ---------------------------------------------------------------------------
// Purchase return
// ---------------------------------------------------------------------------

export interface PurchaseReturnLineInput {
  grnLineId: number;
  /** the exact lot going back to the vendor */
  lotId: number;
  quantity: string | number;
}

export interface PurchaseReturnInput {
  grnId: number;
  vendorId: number;
  warehouseId: number;
  returnNumber: string;
  returnDate: string;
  reason?: string | null;
  lines: PurchaseReturnLineInput[];
  idempotencyKey: string;
  userId: number;
}

interface ApAllocation {
  apId: number;
  vendorInvoiceLineId: number;
  quantity: string;
  unitPrice: string;
  amount: string;
}

/**
 * Send goods back to a vendor.
 *
 * Returns consume the un-invoiced quantity first, because that is what actually happens: the
 * goods are rejected before anyone has billed for them. Only once there is nothing un-invoiced
 * left does a return reach into quantity that has already been charged, and that part becomes
 * a debit note rather than a reversal of the accrual.
 */
export async function postPurchaseReturn(input: PurchaseReturnInput): Promise<any> {
  if (!input.idempotencyKey) throw new ReturnsError('INVALID_LINE', 'A purchase return requires an idempotency key.');
  if (!input.returnNumber) throw new ReturnsError('INVALID_LINE', 'A purchase return requires a return number.');
  if (!input.lines?.length) throw new ReturnsError('INVALID_LINE', 'A purchase return must have at least one line.');
  assertNoDuplicates(input.lines.map(l => Number(l.grnLineId)), 'Receipt line');

  return dbTransaction(async (conn: any) => {
    const [prior] = await conn.execute(
      'SELECT id, journal_entry_id FROM purchase_returns WHERE idempotency_key = ? FOR UPDATE',
      [input.idempotencyKey]
    );
    if ((prior as any[]).length > 0) {
      const existing = (prior as any[])[0];
      return { purchase_return_id: existing.id, journal_id: existing.journal_entry_id, replay: true };
    }

    const [retResult] = await conn.execute(
      `INSERT INTO purchase_returns
       (return_number, vendor_id, grn_id, warehouse_id, return_date, reason, idempotency_key, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.returnNumber, input.vendorId, input.grnId, input.warehouseId,
        input.returnDate, input.reason || null, input.idempotencyKey, input.userId,
      ]
    );
    const returnId = retResult.insertId;

    // receipt lines in ascending id order, so concurrent returns serialise rather than deadlock
    const sorted = [...input.lines].sort((a, b) => Number(a.grnLineId) - Number(b.grnLineId));

    let inventoryCredit = money('0');
    let grniDebit = money('0');
    let apDebit = money('0');
    const apAllocations: ApAllocation[] = [];
    const apTouched = new Map<number, string>();

    for (const line of sorted) {
      const qty = qtyRound(money(String(line.quantity)));
      if (qty.lessThanOrEqualTo(0)) {
        throw new ReturnsError('INVALID_LINE', `Receipt line ${line.grnLineId} must return a positive quantity.`);
      }
      if (!line.lotId) {
        throw new ReturnsError('INVALID_LINE', `Receipt line ${line.grnLineId} needs the exact lot going back.`);
      }

      const [rows] = await conn.execute(
        `SELECT gl.id, gl.grn_id, gl.product_id, gl.quantity_received, gl.unit_cost,
                COALESCE(gl.quantity_invoiced, 0) AS quantity_invoiced,
                COALESCE(gl.quantity_returned, 0) AS quantity_returned,
                COALESCE(gl.quantity_returned_billed, 0) AS quantity_returned_billed,
                po.vendor_id, po.id AS po_id
           FROM grn_lines gl
           JOIN goods_receipts gr ON gr.id = gl.grn_id
           JOIN purchase_orders po ON po.id = gr.po_id
          WHERE gl.id = ?
          FOR UPDATE`,
        [line.grnLineId]
      );
      const grnLine = (rows as any[])[0];
      if (!grnLine) {
        throw new ReturnsError('GRN_LINE_NOT_FOUND', `Receipt line ${line.grnLineId} does not exist.`, {
          grnLineId: line.grnLineId,
        });
      }
      if (Number(grnLine.grn_id) !== Number(input.grnId)) {
        throw new ReturnsError(
          'GRN_LINE_NOT_FOUND',
          `Receipt line ${line.grnLineId} belongs to receipt ${grnLine.grn_id}, not ${input.grnId}.`,
          { grnLineId: line.grnLineId, actualGrnId: grnLine.grn_id }
        );
      }
      if (Number(grnLine.vendor_id) !== Number(input.vendorId)) {
        throw new ReturnsError(
          'VENDOR_MISMATCH',
          `Receipt line ${line.grnLineId} belongs to vendor ${grnLine.vendor_id}, not vendor ${input.vendorId}.`,
          { grnLineId: line.grnLineId, receiptVendorId: grnLine.vendor_id }
        );
      }

      const received = qtyRound(money(String(grnLine.quantity_received)));
      const invoiced = qtyRound(money(String(grnLine.quantity_invoiced)));
      const returned = qtyRound(money(String(grnLine.quantity_returned)));
      const returnedBilled = qtyRound(money(String(grnLine.quantity_returned_billed)));

      if (qtyRound(returned.plus(qty)).greaterThan(received)) {
        throw new ReturnsError(
          'OVER_RETURN_QUANTITY',
          `Returning ${toDbString(qty, 4)} would take the returned total to ${toDbString(qtyRound(returned.plus(qty)), 4)} ` +
            `against ${toDbString(received, 4)} received.`,
          {
            grnLineId: line.grnLineId,
            received: toDbString(received, 4),
            alreadyReturned: toDbString(returned, 4),
          }
        );
      }

      // un-invoiced goods go back against the accrual; the rest becomes a debit note
      const returnedUnbilled = qtyRound(returned.minus(returnedBilled));
      const uninvoicedPool = qtyRound(received.minus(invoiced).minus(returnedUnbilled));
      const fromUninvoiced = qty.greaterThan(uninvoicedPool) ? uninvoicedPool : qty;
      const fromInvoiced = qtyRound(qty.minus(fromUninvoiced));

      // physical stock leaves
      const [stockRows] = await conn.execute(
        `SELECT id, quantity FROM inventory_stocks
          WHERE lot_id = ? AND warehouse_id = ? AND product_id = ? AND status IN ('available', 'qc_hold')
          ORDER BY id ASC FOR UPDATE`,
        [line.lotId, input.warehouseId, grnLine.product_id]
      );
      const stock = (stockRows as any[])[0];
      if (!stock) {
        throw new ReturnsError(
          'INSUFFICIENT_STOCK',
          `Lot ${line.lotId} holds no stock of product ${grnLine.product_id} in warehouse ${input.warehouseId}.`,
          { lotId: line.lotId, productId: grnLine.product_id }
        );
      }
      const onHand = qtyRound(money(String(stock.quantity)));
      if (qty.greaterThan(onHand)) {
        throw new ReturnsError(
          'INSUFFICIENT_STOCK',
          `Lot ${line.lotId} holds ${toDbString(onHand, 4)} but ${toDbString(qty, 4)} is being returned.`,
          { lotId: line.lotId, available: toDbString(onHand, 4) }
        );
      }

      await conn.execute(
        'UPDATE inventory_stocks SET quantity = quantity - ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?',
        [toDbString(qty, 4), stock.id]
      );

      const [movement] = await conn.execute(
        `INSERT INTO stock_movements
         (warehouse_id, product_id, movement_type, quantity, reference_type, reference_id, lot_id, notes, created_by)
         VALUES (?, ?, 'out', ?, 'purchase_return', ?, ?, ?, ?)`,
        [
          input.warehouseId, grnLine.product_id, toDbString(qty, 4), returnId, line.lotId,
          `Returned to vendor on ${input.returnNumber}`, input.userId,
        ]
      );

      // the goods leave inventory at what they were actually carried at
      const alloc = await allocateCostFromLayer(conn, {
        lotId: line.lotId,
        productId: Number(grnLine.product_id),
        quantity: toDbString(qty, 4),
        movementType: 'return',
        movementId: movement.insertId,
      });

      const [lineResult] = await conn.execute(
        `INSERT INTO purchase_return_lines
         (purchase_return_id, grn_line_id, product_id, lot_id, quantity, unit_cost, total_cost,
          uninvoiced_quantity, invoiced_quantity, cost_layer_id, stock_movement_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          returnId, line.grnLineId, grnLine.product_id, line.lotId, toDbString(qty, 4),
          alloc.unitCost, alloc.totalCost, toDbString(fromUninvoiced, 4), toDbString(fromInvoiced, 4),
          alloc.costLayerId, movement.insertId,
        ]
      );
      const returnLineId = lineResult.insertId;

      inventoryCredit = inventoryCredit.plus(money(alloc.totalCost));
      grniDebit = grniDebit.plus(moneyRound(fromUninvoiced.times(money(String(grnLine.unit_cost)))));

      // the billed part is charged back at what the vendor actually charged, which may have
      // been more than one invoice if the receipt was billed in stages
      if (fromInvoiced.greaterThan(0)) {
        const allocations = await allocateDebitNote(conn, line.grnLineId, fromInvoiced, returnLineId);
        for (const a of allocations) {
          apAllocations.push(a);
          apDebit = apDebit.plus(money(a.amount));
          apTouched.set(a.apId, toDbString(money(apTouched.get(a.apId) || '0').plus(money(a.amount))));
        }
      }

      await conn.execute(
        `UPDATE grn_lines
            SET quantity_returned = COALESCE(quantity_returned, 0) + ?,
                quantity_returned_billed = COALESCE(quantity_returned_billed, 0) + ?
          WHERE id = ?`,
        [toDbString(qty, 4), toDbString(fromInvoiced, 4), line.grnLineId]
      );
    }

    inventoryCredit = moneyRound(inventoryCredit);
    grniDebit = moneyRound(grniDebit);
    apDebit = moneyRound(apDebit);

    // reduce each payable the debit note reaches, and refuse to debit-note money already paid
    for (const [apId, amount] of apTouched) {
      const [apRows] = await conn.execute(
        `SELECT id, amount, COALESCE(paid_amount, 0) AS paid_amount,
                COALESCE(debit_note_amount, 0) AS debit_note_amount
           FROM accounts_payable WHERE id = ? FOR UPDATE`,
        [apId]
      );
      const ap = (apRows as any[])[0];
      const outstanding = moneyRound(
        money(String(ap.amount)).minus(money(String(ap.paid_amount))).minus(money(String(ap.debit_note_amount)))
      );
      if (money(amount).greaterThan(outstanding)) {
        throw new ReturnsError(
          'RETURN_ALREADY_PAID',
          `A debit note of ${amount} against payable ${apId} exceeds the ${toDbString(outstanding)} still outstanding. ` +
            'Money already paid has to come back as a refund, not a debit note.',
          { apId, requested: amount, outstanding: toDbString(outstanding) }
        );
      }
      const newDebitNote = moneyRound(money(String(ap.debit_note_amount)).plus(money(amount)));
      const settled = moneyRound(money(String(ap.paid_amount)).plus(newDebitNote));
      await conn.execute(
        'UPDATE accounts_payable SET debit_note_amount = ?, status = ? WHERE id = ?',
        [toDbString(newDebitNote), settled.greaterThanOrEqualTo(money(String(ap.amount))) ? 'closed' : 'open', apId]
      );
    }

    // whatever the three known figures do not settle between them is price variance: the
    // goods were carried at one cost and charged at another, and that gap is real
    const variance = moneyRound(inventoryCredit.minus(grniDebit).minus(apDebit));

    const inventoryAccount = await resolveAccountByRole(
      conn, 'INVENTORY_RM_AVAILABLE', { warehouseId: input.warehouseId }, input.returnDate
    );

    const lines: JournalLineInput[] = [];
    if (grniDebit.greaterThan(0)) {
      const grniAccount = await resolveAccountByRole(conn, 'GRNI', {}, input.returnDate);
      lines.push({
        accountId: grniAccount.accountId,
        description: `Return ${input.returnNumber} reverses the goods-received accrual`,
        debit: toDbString(grniDebit),
        credit: '0',
        vendorId: input.vendorId,
      });
    }
    if (apDebit.greaterThan(0)) {
      const apAccount = await resolveAccountByRole(conn, 'AP_CONTROL', {}, input.returnDate);
      lines.push({
        accountId: apAccount.accountId,
        description: `Debit note ${input.returnNumber} against the vendor`,
        debit: toDbString(apDebit),
        credit: '0',
        vendorId: input.vendorId,
      });
    }
    if (!variance.isZero()) {
      const varianceAccount = await resolveAccountByRole(conn, 'PURCHASE_PRICE_VARIANCE', {}, input.returnDate);
      const positive = variance.greaterThan(0);
      lines.push({
        accountId: varianceAccount.accountId,
        description: `Cost difference on return ${input.returnNumber}`,
        debit: positive ? toDbString(variance) : '0',
        credit: positive ? '0' : toDbString(variance.negated()),
        vendorId: input.vendorId,
      });
    }
    lines.push({
      accountId: inventoryAccount.accountId,
      description: `Goods returned to vendor on ${input.returnNumber}`,
      debit: '0',
      credit: toDbString(inventoryCredit),
      vendorId: input.vendorId,
    });

    const journal = await postSystemJournal(conn, {
      sourceModule: 'PROCUREMENT',
      sourceType: 'purchase_return',
      sourceId: returnId,
      sourceEventType: 'PURCHASE_RETURN_POSTED',
      businessDate: input.returnDate,
      description: `Purchase return ${input.returnNumber}`,
      lines,
      idempotencyKey: `purchase-return-${input.idempotencyKey}`,
      userId: input.userId,
    });

    await conn.execute(
      `UPDATE purchase_returns
          SET journal_entry_id = ?, total_cost = ?, grni_amount = ?, debit_note_amount = ?, price_variance = ?
        WHERE id = ?`,
      [journal.journal_id, toDbString(inventoryCredit), toDbString(grniDebit), toDbString(apDebit), toDbString(variance), returnId]
    );

    return {
      purchase_return_id: returnId,
      journal_id: journal.journal_id,
      total_cost: toDbString(inventoryCredit),
      grni_amount: toDbString(grniDebit),
      debit_note_amount: toDbString(apDebit),
      price_variance: toDbString(variance),
      payables_touched: apAllocations.length,
    };
  });
}

/**
 * Spread the billed part of a return across the invoice lines that billed it, oldest first,
 * so a receipt billed in stages is credited back at the price each stage actually charged.
 */
async function allocateDebitNote(
  conn: any,
  grnLineId: number,
  quantity: any,
  returnLineId: number
): Promise<ApAllocation[]> {
  const [vilRows] = await conn.execute(
    `SELECT vil.id, vil.ap_id, vil.quantity_invoiced, vil.unit_price,
            COALESCE((SELECT SUM(a.quantity) FROM purchase_return_ap_allocations a
                       WHERE a.vendor_invoice_line_id = vil.id), 0) AS already_returned
       FROM vendor_invoice_lines vil
       JOIN accounts_payable ap ON ap.id = vil.ap_id
      WHERE vil.grn_line_id = ? AND vil.reversed_at IS NULL AND ap.superseded_seq = 0
      ORDER BY vil.id ASC`,
    [grnLineId]
  );

  let remaining = quantity;
  const out: ApAllocation[] = [];

  for (const vil of vilRows as any[]) {
    if (remaining.lessThanOrEqualTo(0)) break;
    const billed = qtyRound(money(String(vil.quantity_invoiced)));
    const returned = qtyRound(money(String(vil.already_returned)));
    const available = qtyRound(billed.minus(returned));
    if (available.lessThanOrEqualTo(0)) continue;

    const take = remaining.greaterThan(available) ? available : remaining;
    const unitPrice = moneyRound(money(String(vil.unit_price)));
    const amount = moneyRound(take.times(unitPrice));

    await conn.execute(
      `INSERT INTO purchase_return_ap_allocations
       (purchase_return_line_id, ap_id, vendor_invoice_line_id, quantity, unit_price, amount)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [returnLineId, vil.ap_id, vil.id, toDbString(take, 4), toDbString(unitPrice), toDbString(amount)]
    );

    out.push({
      apId: Number(vil.ap_id),
      vendorInvoiceLineId: Number(vil.id),
      quantity: toDbString(take, 4),
      unitPrice: toDbString(unitPrice),
      amount: toDbString(amount),
    });
    remaining = qtyRound(remaining.minus(take));
  }

  if (remaining.greaterThan(0)) {
    // the receipt line says this much was billed, but no invoice line accounts for it
    throw new ReturnsError(
      'OVER_RETURN_QUANTITY',
      `Receipt line ${grnLineId} has ${toDbString(remaining, 4)} of billed quantity with no invoice line behind it.`,
      { grnLineId, unallocated: toDbString(remaining, 4) }
    );
  }

  return out;
}

// ---------------------------------------------------------------------------
// Sales return
// ---------------------------------------------------------------------------

export interface SalesReturnLineInput {
  deliveryItemId: number;
  quantity: string | number;
  /** goods fit to sell again go back into stock; damaged goods do not */
  restocked?: boolean;
  /** what we charged, for the credit note */
  unitPrice?: string | number;
}

export interface SalesReturnInput {
  deliveryId: number;
  customerId: number;
  warehouseId: number;
  returnNumber: string;
  returnDate: string;
  /** the invoice being credited, when the sale had already been invoiced */
  invoiceId?: number | null;
  /** output tax to reverse along with the revenue */
  taxAmount?: string | number | null;
  reason?: string | null;
  lines: SalesReturnLineInput[];
  idempotencyKey: string;
  userId: number;
}

/**
 * Take goods back from a customer.
 *
 * The goods and the money are handled separately on purpose. Stock only comes back if it can
 * be sold again -- writing damaged goods back into inventory would overstate what we own --
 * while the credit note reverses the revenue either way, because the sale is undone whatever
 * condition the goods returned in.
 */
export async function postSalesReturn(input: SalesReturnInput): Promise<any> {
  if (!input.idempotencyKey) throw new ReturnsError('INVALID_LINE', 'A sales return requires an idempotency key.');
  if (!input.returnNumber) throw new ReturnsError('INVALID_LINE', 'A sales return requires a return number.');
  if (!input.lines?.length) throw new ReturnsError('INVALID_LINE', 'A sales return must have at least one line.');
  assertNoDuplicates(input.lines.map(l => Number(l.deliveryItemId)), 'Delivery line');

  const tax = moneyRound(money(String(input.taxAmount ?? '0')));
  if (tax.isNegative()) throw new ReturnsError('INVALID_LINE', 'Tax on a credit note cannot be negative.');

  return dbTransaction(async (conn: any) => {
    const [prior] = await conn.execute(
      'SELECT id, journal_entry_id FROM sales_returns WHERE idempotency_key = ? FOR UPDATE',
      [input.idempotencyKey]
    );
    if ((prior as any[]).length > 0) {
      const existing = (prior as any[])[0];
      return { sales_return_id: existing.id, journal_id: existing.journal_entry_id, replay: true };
    }

    const [delRows] = await conn.execute(
      'SELECT id, do_number, so_id FROM deliveries WHERE id = ? FOR UPDATE',
      [input.deliveryId]
    );
    const delivery = (delRows as any[])[0];
    if (!delivery) throw new ReturnsError('DELIVERY_NOT_FOUND', `Delivery ${input.deliveryId} not found.`);

    const [retResult] = await conn.execute(
      `INSERT INTO sales_returns
       (return_number, customer_id, delivery_id, so_id, invoice_id, warehouse_id, return_date, reason,
        idempotency_key, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.returnNumber, input.customerId, input.deliveryId, delivery.so_id || null,
        input.invoiceId || null, input.warehouseId, input.returnDate, input.reason || null,
        input.idempotencyKey, input.userId,
      ]
    );
    const returnId = retResult.insertId;

    const sorted = [...input.lines].sort((a, b) => Number(a.deliveryItemId) - Number(b.deliveryItemId));

    let cogsReversed = money('0');
    let creditNoteNet = money('0');

    for (const line of sorted) {
      const qty = qtyRound(money(String(line.quantity)));
      if (qty.lessThanOrEqualTo(0)) {
        throw new ReturnsError('INVALID_LINE', `Delivery line ${line.deliveryItemId} must return a positive quantity.`);
      }

      const [rows] = await conn.execute(
        `SELECT di.id, di.delivery_id, di.product_id, di.lot_id, di.quantity_delivered,
                di.unit_cost, di.cost_layer_id, di.warehouse_id,
                COALESCE(di.quantity_returned, 0) AS quantity_returned
           FROM delivery_items di
          WHERE di.id = ?
          FOR UPDATE`,
        [line.deliveryItemId]
      );
      const item = (rows as any[])[0];
      if (!item) {
        throw new ReturnsError('DELIVERY_ITEM_NOT_FOUND', `Delivery line ${line.deliveryItemId} does not exist.`, {
          deliveryItemId: line.deliveryItemId,
        });
      }
      if (Number(item.delivery_id) !== Number(input.deliveryId)) {
        throw new ReturnsError(
          'DELIVERY_ITEM_NOT_FOUND',
          `Delivery line ${line.deliveryItemId} belongs to delivery ${item.delivery_id}, not ${input.deliveryId}.`,
          { deliveryItemId: line.deliveryItemId, actualDeliveryId: item.delivery_id }
        );
      }

      const delivered = qtyRound(money(String(item.quantity_delivered)));
      const returned = qtyRound(money(String(item.quantity_returned)));
      if (qtyRound(returned.plus(qty)).greaterThan(delivered)) {
        throw new ReturnsError(
          'OVER_RETURN_QUANTITY',
          `Returning ${toDbString(qty, 4)} would take the returned total to ` +
            `${toDbString(qtyRound(returned.plus(qty)), 4)} against ${toDbString(delivered, 4)} delivered.`,
          {
            deliveryItemId: line.deliveryItemId,
            delivered: toDbString(delivered, 4),
            alreadyReturned: toDbString(returned, 4),
          }
        );
      }

      const restocked = line.restocked !== false;
      let unitCost = moneyRound(money(String(item.unit_cost ?? '0')));
      let totalCost = moneyRound(unitCost.times(qty));
      let movementId: number | null = null;
      let costLayerId: number | null = item.cost_layer_id ?? null;

      if (restocked) {
        if (!item.lot_id || !item.cost_layer_id) {
          throw new ReturnsError(
            'INVALID_LINE',
            `Delivery line ${line.deliveryItemId} has no lot or cost layer, so returned goods cannot be put back at what they cost.`,
            { deliveryItemId: line.deliveryItemId }
          );
        }

        const [movement] = await conn.execute(
          `INSERT INTO stock_movements
           (warehouse_id, product_id, movement_type, quantity, reference_type, reference_id, lot_id, notes, created_by)
           VALUES (?, ?, 'in', ?, 'sales_return', ?, ?, ?, ?)`,
          [
            input.warehouseId, item.product_id, toDbString(qty, 4), returnId, item.lot_id,
            `Returned by customer on ${input.returnNumber}`, input.userId,
          ]
        );
        movementId = movement.insertId;

        // the cost goes back to the layer it was taken from, at that layer's cost
        const restore = await restoreCostToLayer(conn, {
          costLayerId: Number(item.cost_layer_id),
          quantity: toDbString(qty, 4),
          movementType: 'return',
          movementId: movementId as number,
        });
        unitCost = moneyRound(money(restore.unitCost));
        totalCost = moneyRound(money(restore.totalCost));
        costLayerId = restore.costLayerId;

        // back on the shelf, in the lot it left from
        const [stockRows] = await conn.execute(
          `SELECT id FROM inventory_stocks
            WHERE lot_id = ? AND warehouse_id = ? AND product_id = ? AND status = 'available'
            ORDER BY id ASC FOR UPDATE`,
          [item.lot_id, input.warehouseId, item.product_id]
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
            [input.warehouseId, item.product_id, toDbString(qty, 4), item.lot_id]
          );
        }

        cogsReversed = cogsReversed.plus(totalCost);
      }

      const unitPrice = moneyRound(money(String(line.unitPrice ?? '0')));
      if (unitPrice.isNegative()) {
        throw new ReturnsError('INVALID_LINE', `Delivery line ${line.deliveryItemId} cannot be credited at a negative price.`);
      }
      const lineNet = moneyRound(qty.times(unitPrice));
      creditNoteNet = creditNoteNet.plus(lineNet);

      await conn.execute(
        `INSERT INTO sales_return_lines
         (sales_return_id, delivery_item_id, product_id, lot_id, quantity, restocked,
          unit_cost, total_cost, unit_price, line_net, cost_layer_id, stock_movement_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          returnId, line.deliveryItemId, item.product_id, item.lot_id, toDbString(qty, 4),
          restocked ? 1 : 0, toDbString(unitCost), toDbString(totalCost),
          toDbString(unitPrice), toDbString(lineNet), costLayerId, movementId,
        ]
      );

      await conn.execute(
        'UPDATE delivery_items SET quantity_returned = COALESCE(quantity_returned, 0) + ? WHERE id = ?',
        [toDbString(qty, 4), line.deliveryItemId]
      );
    }

    cogsReversed = moneyRound(cogsReversed);
    creditNoteNet = moneyRound(creditNoteNet);
    const creditNoteGross = moneyRound(creditNoteNet.plus(tax));

    const lines: JournalLineInput[] = [];

    // the goods, if they came back fit to sell
    if (cogsReversed.greaterThan(0)) {
      const fgAccount = await resolveAccountByRole(
        conn, 'INVENTORY_FG_AVAILABLE', { warehouseId: input.warehouseId }, input.returnDate
      );
      const cogsAccount = await resolveAccountByRole(conn, 'COGS_PRODUCT', {}, input.returnDate);
      lines.push({
        accountId: fgAccount.accountId,
        description: `Goods returned to stock on ${input.returnNumber}`,
        debit: toDbString(cogsReversed),
        credit: '0',
        customerId: input.customerId,
      });
      lines.push({
        accountId: cogsAccount.accountId,
        description: `Cost of sales reversed by ${input.returnNumber}`,
        debit: '0',
        credit: toDbString(cogsReversed),
        customerId: input.customerId,
      });
    }

    // the money, if the sale had been invoiced
    let arId: number | null = null;
    if (creditNoteGross.greaterThan(0)) {
      if (!input.invoiceId) {
        throw new ReturnsError(
          'AR_NOT_FOUND',
          'A credit note needs the invoice it credits; a return priced without one has nothing to reduce.'
        );
      }
      const [arRows] = await conn.execute(
        `SELECT id, amount, COALESCE(paid_amount, 0) AS paid_amount,
                COALESCE(credit_note_amount, 0) AS credit_note_amount
           FROM accounts_receivable WHERE invoice_id = ? AND superseded_seq = 0 FOR UPDATE`,
        [input.invoiceId]
      );
      const ar = (arRows as any[])[0];
      if (!ar) {
        throw new ReturnsError('AR_NOT_FOUND', `No receivable exists for invoice ${input.invoiceId}.`, {
          invoiceId: input.invoiceId,
        });
      }
      arId = Number(ar.id);

      const outstanding = moneyRound(
        money(String(ar.amount)).minus(money(String(ar.paid_amount))).minus(money(String(ar.credit_note_amount)))
      );
      if (creditNoteGross.greaterThan(outstanding)) {
        throw new ReturnsError(
          'CREDIT_NOTE_EXCEEDS_RECEIVABLE',
          `A credit note of ${toDbString(creditNoteGross)} exceeds the ${toDbString(outstanding)} still outstanding on ` +
            `invoice ${input.invoiceId}. Money already collected has to go back as a refund, not a credit note.`,
          { invoiceId: input.invoiceId, requested: toDbString(creditNoteGross), outstanding: toDbString(outstanding) }
        );
      }

      const newCreditNote = moneyRound(money(String(ar.credit_note_amount)).plus(creditNoteGross));
      const settled = moneyRound(money(String(ar.paid_amount)).plus(newCreditNote));
      await conn.execute(
        'UPDATE accounts_receivable SET credit_note_amount = ?, status = ? WHERE id = ?',
        [toDbString(newCreditNote), settled.greaterThanOrEqualTo(money(String(ar.amount))) ? 'closed' : 'open', arId]
      );

      const arAccount = await resolveAccountByRole(conn, 'AR_CONTROL', {}, input.returnDate);
      const revenueAccount = await resolveAccountByRole(conn, 'SALES_REVENUE_PRODUCT', {}, input.returnDate);

      lines.push({
        accountId: revenueAccount.accountId,
        description: `Revenue reversed by credit note ${input.returnNumber}`,
        debit: toDbString(creditNoteNet),
        credit: '0',
        customerId: input.customerId,
      });
      if (tax.greaterThan(0)) {
        const taxAccount = await resolveAccountByRole(conn, 'OUTPUT_TAX', {}, input.returnDate);
        lines.push({
          accountId: taxAccount.accountId,
          description: `Output tax reversed by credit note ${input.returnNumber}`,
          debit: toDbString(tax),
          credit: '0',
          customerId: input.customerId,
        });
      }
      lines.push({
        accountId: arAccount.accountId,
        description: `Credit note ${input.returnNumber} against the customer`,
        debit: '0',
        credit: toDbString(creditNoteGross),
        customerId: input.customerId,
      });
    }

    if (lines.length === 0) {
      throw new ReturnsError(
        'INVALID_LINE',
        'This return moves nothing: the goods were not restocked and no credit note was raised.'
      );
    }

    const journal = await postSystemJournal(conn, {
      sourceModule: 'SALES',
      sourceType: 'sales_return',
      sourceId: returnId,
      sourceEventType: 'SALES_RETURN_POSTED',
      businessDate: input.returnDate,
      description: `Sales return ${input.returnNumber}`,
      lines,
      idempotencyKey: `sales-return-${input.idempotencyKey}`,
      userId: input.userId,
    });

    await conn.execute(
      `UPDATE sales_returns
          SET journal_entry_id = ?, ar_id = ?, cogs_reversed = ?, credit_note_net = ?,
              credit_note_tax = ?, credit_note_gross = ?
        WHERE id = ?`,
      [
        journal.journal_id, arId, toDbString(cogsReversed), toDbString(creditNoteNet),
        toDbString(tax), toDbString(creditNoteGross), returnId,
      ]
    );

    return {
      sales_return_id: returnId,
      journal_id: journal.journal_id,
      cogs_reversed: toDbString(cogsReversed),
      credit_note_net: toDbString(creditNoteNet),
      credit_note_tax: toDbString(tax),
      credit_note_gross: toDbString(creditNoteGross),
      ar_id: arId,
    };
  });
}
