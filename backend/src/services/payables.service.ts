import { dbTransaction } from '../config/database';
import { postSystemJournal, JournalLineInput } from './accounting-posting.service';
import { resolveAccountByRole } from './account-role.service';
import { money, moneyRound, toDbString } from '../lib/decimal';

// Payables posting.
//
// Goods receipt credits GRNI: "we hold the goods, the invoice has not arrived". Nothing
// cleared it, so GRNI only ever grew and the liability to the vendor never reached the
// ledger. These two commands close that loop:
//
//   vendor invoice  Dr GRNI          Cr Accounts Payable
//   payment         Dr Accounts Payable   Cr Bank or Cash
//
// Each one writes the operational row and its journal in a single transaction, so a payable
// cannot exist without the entry that recognises it.

export type PayablesErrorCode =
  | 'AP_NOT_FOUND'
  | 'INVALID_AMOUNT'
  | 'OVER_PAYMENT'
  | 'DUPLICATE_INVOICE'
  | 'AP_ALREADY_POSTED';

const STATUS: Record<PayablesErrorCode, number> = {
  AP_NOT_FOUND: 404,
  INVALID_AMOUNT: 422,
  OVER_PAYMENT: 409,
  DUPLICATE_INVOICE: 409,
  AP_ALREADY_POSTED: 409,
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
  userId: number;
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

    const [apResult] = await conn.execute(
      `INSERT INTO accounts_payable
       (po_id, po_schedule_id, grn_id, vendor_id, invoice_number, invoice_date, due_date,
        amount, paid_amount, status, notes, posted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'open', ?, NOW())`,
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
      ]
    );
    const apId = apResult.insertId;

    const grniAccount = await resolveAccountByRole(conn, 'GRNI', {}, input.invoiceDate);
    const apAccount = await resolveAccountByRole(conn, 'AP_CONTROL', {}, input.invoiceDate);

    const lines: JournalLineInput[] = [
      {
        accountId: grniAccount.accountId,
        description: `Vendor invoice ${input.invoiceNumber} clears goods received`,
        debit: toDbString(amount),
        credit: '0',
        vendorId: input.vendorId,
      },
      {
        accountId: apAccount.accountId,
        description: `Vendor invoice ${input.invoiceNumber} payable`,
        debit: '0',
        credit: toDbString(amount),
        vendorId: input.vendorId,
      },
    ];

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

    return { ap_id: apId, journal_id: journal.journal_id, amount: toDbString(amount) };
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
