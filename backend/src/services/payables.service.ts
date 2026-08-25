import { dbTransaction } from '../config/database';
import { postSystemJournal, JournalLineInput } from './accounting-posting.service';
import { resolveAccountByRole } from './account-role.service';
import { money, moneyRound, qtyRound, toDbString, Decimal } from '../lib/decimal';

// Payables posting.
//
// Goods receipt credits GRNI: "we hold the goods, the invoice has not arrived". Nothing
// cleared it, so GRNI only ever grew and the liability to the vendor never reached the
// ledger. These commands close that loop:
//
//   vendor invoice  Dr GRNI    Dr/Cr price variance    Cr Accounts Payable
//   payment         Dr Accounts Payable                Cr Bank or Cash
//
// Each one writes the operational row and its journal in a single transaction, so a payable
// cannot exist without the entry that recognises it.
//
// When the invoice carries receipt lines it is matched three ways before anything posts: the
// purchase order says what was agreed, the goods receipt says what arrived, and the invoice
// says what is being charged. Quantity is checked against what was actually received and
// against what has already been billed, so a vendor cannot invoice goods that never came or
// bill the same delivery twice. Price is checked against what the receipt accrued.
//
// GRNI is then cleared by exactly what was accrued into it, never by the invoice total. Those
// two differ whenever the vendor's price differs from the order, and debiting GRNI by the
// invoice amount left that difference sitting in the account permanently. The difference is
// purchase price variance and belongs in its own account, where it can be seen.

export type PayablesErrorCode =
  | 'AP_NOT_FOUND'
  | 'INVALID_AMOUNT'
  | 'OVER_PAYMENT'
  | 'DUPLICATE_INVOICE'
  | 'AP_ALREADY_POSTED'
  | 'GRN_LINE_NOT_FOUND'
  | 'VENDOR_MISMATCH'
  | 'OVER_BILLED_QUANTITY'
  | 'PRICE_VARIANCE_EXCEEDED'
  | 'INVOICE_TOTAL_MISMATCH';

const STATUS: Record<PayablesErrorCode, number> = {
  AP_NOT_FOUND: 404,
  INVALID_AMOUNT: 422,
  OVER_PAYMENT: 409,
  DUPLICATE_INVOICE: 409,
  AP_ALREADY_POSTED: 409,
  GRN_LINE_NOT_FOUND: 404,
  VENDOR_MISMATCH: 409,
  OVER_BILLED_QUANTITY: 409,
  PRICE_VARIANCE_EXCEEDED: 422,
  INVOICE_TOTAL_MISMATCH: 422,
};

export class PayablesError extends Error {
  public readonly code: PayablesErrorCode;
  public readonly httpStatus: number;
  public readonly data?: Record<string, unknown>;

  constructor(code: PayablesErrorCode, message: string, data?: Record<string, unknown>) {
    super(message);
    this.name = 'PayablesError';
    this.code = code;
    this.httpStatus = STATUS[code];
    this.data = data;
  }
}

/** One billed receipt line. The product and PO line are read from the receipt, not supplied. */
export interface VendorInvoiceLineInput {
  grnLineId: number;
  quantity: string | number;
  unitPrice: string | number;
}

export interface VendorInvoiceInput {
  poId?: number | null;
  poScheduleId?: number | null;
  grnId?: number | null;
  vendorId: number;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string | null;
  amount: string | number;
  notes?: string | null;
  /** receipt lines being billed; when given, the invoice is matched three ways */
  lines?: VendorInvoiceLineInput[];
  /** accepts a variance beyond tolerance, on the record */
  varianceApproval?: { reason: string; authorizedBy: number } | null;
  userId: number;
}

interface MatchedLine {
  grnLineId: number;
  poItemId: number;
  productId: number;
  quantity: string;
  unitPrice: string;
  receivedUnitCost: string;
  lineAmount: string;
  grniAmount: string;
  variance: string;
  toleranceExceeded: boolean;
}

interface Tolerance {
  percent: Decimal;
  absolute: Decimal;
}

async function loadTolerance(conn: any, onDate: string): Promise<Tolerance> {
  const [rows] = await conn.execute(
    `SELECT price_tolerance_percent, price_tolerance_absolute
       FROM accounting_settings
      WHERE effective_from <= ? AND (effective_to IS NULL OR effective_to >= ?)
      ORDER BY effective_from DESC LIMIT 1`,
    [onDate, onDate]
  );
  const row = (rows as any[])[0];
  // No configured tolerance means nothing is waved through automatically. Failing closed is
  // the right default for a control: an unconfigured system should ask, not assume.
  return {
    percent: money(String(row?.price_tolerance_percent ?? 0)),
    absolute: money(String(row?.price_tolerance_absolute ?? 0)),
  };
}

/**
 * Match the billed lines against what was ordered and what arrived.
 *
 * Receipt lines are locked in ascending id order so that two invoices racing the same
 * delivery serialise instead of both passing against the same snapshot.
 */
async function matchInvoiceLines(
  conn: any,
  input: VendorInvoiceInput,
  tolerance: Tolerance
): Promise<MatchedLine[]> {
  const requested = input.lines || [];
  const seen = new Set<number>();
  for (const line of requested) {
    if (seen.has(Number(line.grnLineId))) {
      throw new PayablesError(
        'OVER_BILLED_QUANTITY',
        `Receipt line ${line.grnLineId} appears twice on the same invoice.`,
        { grnLineId: line.grnLineId }
      );
    }
    seen.add(Number(line.grnLineId));
  }

  const ordered = [...requested].sort((a, b) => Number(a.grnLineId) - Number(b.grnLineId));
  const matched: MatchedLine[] = [];

  for (const line of ordered) {
    const quantity = qtyRound(money(String(line.quantity)));
    if (quantity.lessThanOrEqualTo(0)) {
      throw new PayablesError('INVALID_AMOUNT', `Receipt line ${line.grnLineId} must be billed a positive quantity.`);
    }
    const unitPrice = moneyRound(money(String(line.unitPrice)));
    if (unitPrice.lessThan(0)) {
      throw new PayablesError('INVALID_AMOUNT', `Receipt line ${line.grnLineId} cannot carry a negative price.`);
    }

    const [rows] = await conn.execute(
      `SELECT gl.id, gl.po_item_id, gl.product_id, gl.quantity_received, gl.unit_cost,
              COALESCE(gl.quantity_invoiced, 0) AS quantity_invoiced,
              COALESCE(gl.quantity_returned, 0) AS quantity_returned,
              COALESCE(gl.quantity_returned_billed, 0) AS quantity_returned_billed,
              po.vendor_id
         FROM grn_lines gl
         JOIN goods_receipts gr ON gr.id = gl.grn_id
         JOIN purchase_orders po ON po.id = gr.po_id
        WHERE gl.id = ?
        FOR UPDATE`,
      [line.grnLineId]
    );
    const grnLine = (rows as any[])[0];
    if (!grnLine) {
      throw new PayablesError('GRN_LINE_NOT_FOUND', `Receipt line ${line.grnLineId} does not exist.`, {
        grnLineId: line.grnLineId,
      });
    }

    // an invoice from one vendor must not settle another vendor's delivery
    if (Number(grnLine.vendor_id) !== Number(input.vendorId)) {
      throw new PayablesError(
        'VENDOR_MISMATCH',
        `Receipt line ${line.grnLineId} belongs to vendor ${grnLine.vendor_id}, not vendor ${input.vendorId}.`,
        { grnLineId: line.grnLineId, receiptVendorId: grnLine.vendor_id, invoiceVendorId: input.vendorId }
      );
    }

    const received = qtyRound(money(String(grnLine.quantity_received)));
    const alreadyBilled = qtyRound(money(String(grnLine.quantity_invoiced)));
    const billedAfter = qtyRound(alreadyBilled.plus(quantity));

    // Goods sent back before anyone billed for them are no longer billable at all. Goods sent
    // back after being billed still are, because that money is already owed and comes back as
    // a debit note instead; subtracting those too would refuse an invoice that is owed.
    const returnedUnbilled = qtyRound(
      money(String(grnLine.quantity_returned)).minus(money(String(grnLine.quantity_returned_billed)))
    );
    const billable = qtyRound(received.minus(returnedUnbilled));

    // the heart of the match: you may not be billed for more than turned up and stayed
    if (billedAfter.greaterThan(billable)) {
      throw new PayablesError(
        'OVER_BILLED_QUANTITY',
        `Billing ${toDbString(quantity, 4)} against receipt line ${line.grnLineId} would take the billed total to ` +
          `${toDbString(billedAfter, 4)} against ${toDbString(billable, 4)} billable ` +
          `(${toDbString(received, 4)} received less ${toDbString(returnedUnbilled, 4)} returned before invoicing).`,
        {
          grnLineId: line.grnLineId,
          received: toDbString(received, 4),
          returnedBeforeInvoicing: toDbString(returnedUnbilled, 4),
          billable: toDbString(billable, 4),
          alreadyBilled: toDbString(alreadyBilled, 4),
          requested: toDbString(quantity, 4),
        }
      );
    }

    const receivedUnitCost = moneyRound(money(String(grnLine.unit_cost)));
    const lineAmount = moneyRound(quantity.times(unitPrice));
    const grniAmount = moneyRound(quantity.times(receivedUnitCost));
    const variance = moneyRound(lineAmount.minus(grniAmount));

    // tolerated either as a share of the accrued cost or as a flat amount, whichever is
    // larger, so a small line is not held to an unreachably tight absolute figure
    const percentAllowance = moneyRound(grniAmount.abs().times(tolerance.percent).dividedBy(100));
    const allowance = percentAllowance.greaterThan(tolerance.absolute) ? percentAllowance : tolerance.absolute;

    matched.push({
      grnLineId: Number(grnLine.id),
      poItemId: Number(grnLine.po_item_id),
      productId: Number(grnLine.product_id),
      quantity: toDbString(quantity, 4),
      unitPrice: toDbString(unitPrice),
      receivedUnitCost: toDbString(receivedUnitCost),
      lineAmount: toDbString(lineAmount),
      grniAmount: toDbString(grniAmount),
      variance: toDbString(variance),
      toleranceExceeded: variance.abs().greaterThan(allowance),
    });
  }

  return matched;
}

/**
 * Recognise a vendor invoice: the goods-received liability becomes a payable.
 */
export async function postVendorInvoice(input: VendorInvoiceInput): Promise<any> {
  const amount = moneyRound(money(String(input.amount)));
  if (amount.lessThanOrEqualTo(0)) {
    throw new PayablesError('INVALID_AMOUNT', 'A vendor invoice must have a positive amount.');
  }
  if (!input.invoiceNumber) {
    throw new PayablesError('INVALID_AMOUNT', 'A vendor invoice must carry the vendor invoice number.');
  }

  return dbTransaction(async (conn: any) => {
    // the vendor's invoice number identifies one liability; a retry must not create a second
    const [dup] = await conn.execute(
      'SELECT id, amount, journal_entry_id FROM accounts_payable WHERE vendor_id = ? AND invoice_number = ? FOR UPDATE',
      [input.vendorId, input.invoiceNumber]
    );
    if ((dup as any[]).length > 0) {
      const existing = (dup as any[])[0];
      if (toDbString(moneyRound(money(String(existing.amount)))) === toDbString(amount)) {
        return { ap_id: existing.id, journal_id: existing.journal_entry_id, replay: true };
      }
      throw new PayablesError(
        'DUPLICATE_INVOICE',
        `Invoice ${input.invoiceNumber} already exists for this vendor with a different amount.`,
        { apId: existing.id, existingAmount: existing.amount }
      );
    }

    const hasLines = Array.isArray(input.lines) && input.lines.length > 0;
    let matched: MatchedLine[] = [];
    let matchStatus = 'unmatched';
    let grniTotal = amount;
    let varianceTotal = money('0');

    if (hasLines) {
      const tolerance = await loadTolerance(conn, input.invoiceDate);
      matched = await matchInvoiceLines(conn, input, tolerance);

      grniTotal = matched.reduce((sum, l) => moneyRound(sum.plus(money(l.grniAmount))), money('0'));
      varianceTotal = matched.reduce((sum, l) => moneyRound(sum.plus(money(l.variance))), money('0'));
      const lineTotal = matched.reduce((sum, l) => moneyRound(sum.plus(money(l.lineAmount))), money('0'));

      // the header is what the vendor is owed; if the lines do not add up to it, something is
      // being charged that no line explains
      if (!lineTotal.equals(amount)) {
        throw new PayablesError(
          'INVOICE_TOTAL_MISMATCH',
          `The billed lines total ${toDbString(lineTotal)} but the invoice is for ${toDbString(amount)}.`,
          { lineTotal: toDbString(lineTotal), invoiceAmount: toDbString(amount) }
        );
      }

      const breaches = matched.filter(l => l.toleranceExceeded);
      const approval = input.varianceApproval;
      const approved = !!(approval && approval.reason && approval.reason.trim() && approval.authorizedBy);

      if (breaches.length > 0 && !approved) {
        throw new PayablesError(
          'PRICE_VARIANCE_EXCEEDED',
          `${breaches.length} line(s) are priced beyond tolerance against what was received. ` +
            'Accepting this invoice needs an authorised reason.',
          {
            lines: breaches.map(l => ({
              grnLineId: l.grnLineId,
              invoicedUnitPrice: l.unitPrice,
              receivedUnitCost: l.receivedUnitCost,
              variance: l.variance,
            })),
          }
        );
      }

      matchStatus = breaches.length > 0 ? 'variance_approved' : 'matched';
    }

    const [apResult] = await conn.execute(
      `INSERT INTO accounts_payable
       (po_id, po_schedule_id, grn_id, vendor_id, invoice_number, invoice_date, due_date,
        amount, paid_amount, status, notes, posted_at,
        match_status, price_variance, variance_approved_by, variance_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'open', ?, NOW(), ?, ?, ?, ?)`,
      [
        input.poId || null,
        input.poScheduleId || null,
        input.grnId || null,
        input.vendorId,
        input.invoiceNumber,
        input.invoiceDate,
        input.dueDate || null,
        toDbString(amount),
        input.notes || null,
        matchStatus,
        toDbString(varianceTotal),
        matchStatus === 'variance_approved' ? input.varianceApproval?.authorizedBy ?? null : null,
        matchStatus === 'variance_approved' ? input.varianceApproval?.reason ?? null : null,
      ]
    );
    const apId = apResult.insertId;

    for (const line of matched) {
      await conn.execute(
        `INSERT INTO vendor_invoice_lines
         (ap_id, grn_line_id, po_item_id, product_id, quantity_invoiced, unit_price,
          received_unit_cost, line_amount, grni_amount, price_variance)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          apId,
          line.grnLineId,
          line.poItemId,
          line.productId,
          line.quantity,
          line.unitPrice,
          line.receivedUnitCost,
          line.lineAmount,
          line.grniAmount,
          line.variance,
        ]
      );
      // recorded under the same lock the check was made under
      await conn.execute(
        'UPDATE grn_lines SET quantity_invoiced = COALESCE(quantity_invoiced, 0) + ? WHERE id = ?',
        [line.quantity, line.grnLineId]
      );
    }

    const grniAccount = await resolveAccountByRole(conn, 'GRNI', {}, input.invoiceDate);
    const apAccount = await resolveAccountByRole(conn, 'AP_CONTROL', {}, input.invoiceDate);

    const lines: JournalLineInput[] = [
      {
        accountId: grniAccount.accountId,
        description: `Vendor invoice ${input.invoiceNumber} clears goods received`,
        debit: toDbString(grniTotal),
        credit: '0',
        vendorId: input.vendorId,
      },
    ];

    // the difference between what was accrued and what is charged, kept visible
    if (!varianceTotal.isZero()) {
      const varianceAccount = await resolveAccountByRole(conn, 'PURCHASE_PRICE_VARIANCE', {}, input.invoiceDate);
      const positive = varianceTotal.greaterThan(0);
      lines.push({
        accountId: varianceAccount.accountId,
        description: `Purchase price variance on invoice ${input.invoiceNumber}`,
        debit: positive ? toDbString(varianceTotal) : '0',
        credit: positive ? '0' : toDbString(varianceTotal.negated()),
        vendorId: input.vendorId,
      });
    }

    lines.push({
      accountId: apAccount.accountId,
      description: `Vendor invoice ${input.invoiceNumber} payable`,
      debit: '0',
      credit: toDbString(amount),
      vendorId: input.vendorId,
    });

    const journal = await postSystemJournal(conn, {
      sourceModule: 'FINANCE',
      sourceType: 'vendor_invoice',
      sourceId: apId,
      sourceEventType: 'VENDOR_INVOICE_POSTED',
      businessDate: input.invoiceDate,
      description: `Vendor invoice ${input.invoiceNumber}`,
      lines,
      idempotencyKey: `vendor-invoice-${input.vendorId}-${input.invoiceNumber}`,
      userId: input.userId,
    });

    await conn.execute('UPDATE accounts_payable SET journal_entry_id = ? WHERE id = ?', [journal.journal_id, apId]);

    return {
      ap_id: apId,
      journal_id: journal.journal_id,
      amount: toDbString(amount),
      match_status: matchStatus,
      grni_cleared: toDbString(grniTotal),
      price_variance: toDbString(varianceTotal),
      matched_lines: matched.length,
    };
  });
}

export interface ApPaymentInput {
  apId: number;
  amount: string | number;
  paymentDate: string;
  /** which cash or bank account funded it */
  paymentAccountRole?: 'BANK_OPERATING' | 'CASH_ON_HAND';
  reference?: string | null;
  idempotencyKey: string;
  userId: number;
}

/**
 * Settle part or all of a payable, moving the liability to cash.
 */
export async function postApPayment(input: ApPaymentInput): Promise<any> {
  const amount = moneyRound(money(String(input.amount)));
  if (amount.lessThanOrEqualTo(0)) {
    throw new PayablesError('INVALID_AMOUNT', 'A payment must have a positive amount.');
  }
  if (!input.idempotencyKey) {
    throw new PayablesError('INVALID_AMOUNT', 'A payment requires an idempotency key.');
  }

  const accountRole = input.paymentAccountRole || 'BANK_OPERATING';

  return dbTransaction(async (conn: any) => {
    // lock order: payable, then its payments
    const [apRows] = await conn.execute(
      'SELECT id, vendor_id, amount, COALESCE(paid_amount, 0) AS paid_amount, po_schedule_id FROM accounts_payable WHERE id = ? FOR UPDATE',
      [input.apId]
    );
    const ap = (apRows as any[])[0];
    if (!ap) throw new PayablesError('AP_NOT_FOUND', `Payable ${input.apId} not found.`);

    const [existing] = await conn.execute(
      'SELECT id, amount, journal_entry_id FROM ap_payments WHERE ap_id = ? AND idempotency_key = ?',
      [input.apId, input.idempotencyKey]
    );
    if ((existing as any[]).length > 0) {
      const prior = (existing as any[])[0];
      return { payment_id: prior.id, journal_id: prior.journal_entry_id, replay: true };
    }

    const invoiced = moneyRound(money(String(ap.amount)));
    const alreadyPaid = moneyRound(money(String(ap.paid_amount)));
    const newPaid = moneyRound(alreadyPaid.plus(amount));

    if (newPaid.greaterThan(invoiced)) {
      throw new PayablesError(
        'OVER_PAYMENT',
        `Paying ${toDbString(amount)} would take the settled total to ${toDbString(newPaid)} against an invoice of ${toDbString(invoiced)}.`,
        { apId: input.apId, invoiced: toDbString(invoiced), alreadyPaid: toDbString(alreadyPaid) }
      );
    }

    const [payResult] = await conn.execute(
      `INSERT INTO ap_payments (ap_id, vendor_id, amount, payment_date, payment_account_role, reference, idempotency_key, paid_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.apId,
        ap.vendor_id,
        toDbString(amount),
        input.paymentDate,
        accountRole,
        input.reference || null,
        input.idempotencyKey,
        input.userId,
      ]
    );
    const paymentId = payResult.insertId;

    const status = newPaid.greaterThanOrEqualTo(invoiced) ? 'paid' : 'partial';
    await conn.execute(
      'UPDATE accounts_payable SET paid_amount = ?, status = ?, payment_date = ? WHERE id = ?',
      [toDbString(newPaid), status, input.paymentDate, input.apId]
    );

    if (ap.po_schedule_id) {
      await conn.execute(
        'UPDATE purchase_order_payment_schedules SET paid_amount = ?, status = ?, ap_id = ? WHERE id = ?',
        [toDbString(newPaid), status, input.apId, ap.po_schedule_id]
      );
    }

    const apAccount = await resolveAccountByRole(conn, 'AP_CONTROL', {}, input.paymentDate);
    const cashAccount = await resolveAccountByRole(conn, accountRole, {}, input.paymentDate);

    const lines: JournalLineInput[] = [
      {
        accountId: apAccount.accountId,
        description: `Payment for payable ${input.apId}`,
        debit: toDbString(amount),
        credit: '0',
        vendorId: ap.vendor_id,
      },
      {
        accountId: cashAccount.accountId,
        description: `Payment for payable ${input.apId}${input.reference ? ` (${input.reference})` : ''}`,
        debit: '0',
        credit: toDbString(amount),
        vendorId: ap.vendor_id,
      },
    ];

    const journal = await postSystemJournal(conn, {
      sourceModule: 'FINANCE',
      sourceType: 'ap_payment',
      sourceId: paymentId,
      sourceEventType: 'AP_PAYMENT_POSTED',
      businessDate: input.paymentDate,
      description: `Payment for payable ${input.apId}`,
      lines,
      idempotencyKey: `ap-payment-${input.apId}-${input.idempotencyKey}`,
      userId: input.userId,
    });

    await conn.execute('UPDATE ap_payments SET journal_entry_id = ? WHERE id = ?', [journal.journal_id, paymentId]);

    return {
      payment_id: paymentId,
      journal_id: journal.journal_id,
      paid_amount: toDbString(newPaid),
      status,
    };
  });
}
