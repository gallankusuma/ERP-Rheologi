import { dbTransaction } from '../config/database';
import { postSystemJournal, JournalLineInput } from './accounting-posting.service';
import { resolveAccountByRole } from './account-role.service';
import { money, moneyRound, toDbString } from '../lib/decimal';

// Receivables posting.
//
//   customer invoice   Dr Accounts Receivable   Cr Revenue (and tax, when charged)
//   customer receipt   Dr Bank or Cash          Cr Accounts Receivable
//
// The mirror of payables: the operational row and its journal are written in one
// transaction, so a receivable cannot exist without the entry that recognises it.

export type ReceivablesErrorCode =
  | 'INVOICE_NOT_FOUND'
  | 'AR_NOT_FOUND'
  | 'INVALID_AMOUNT'
  | 'OVER_RECEIPT'
  | 'ALREADY_POSTED';

const STATUS: Record<ReceivablesErrorCode, number> = {
  INVOICE_NOT_FOUND: 404,
  AR_NOT_FOUND: 404,
  INVALID_AMOUNT: 422,
  OVER_RECEIPT: 409,
  ALREADY_POSTED: 409,
};

export class ReceivablesError extends Error {
  public readonly code: ReceivablesErrorCode;
  public readonly httpStatus: number;
  public readonly data?: Record<string, unknown>;

  constructor(code: ReceivablesErrorCode, message: string, data?: Record<string, unknown>) {
    super(message);
    this.name = 'ReceivablesError';
    this.code = code;
    this.httpStatus = STATUS[code];
    this.data = data;
  }
}

export interface CustomerInvoiceInput {
  invoiceId: number;
  customerId: number;
  /** revenue excluding tax */
  netAmount: string | number;
  /** output tax charged on top, if any */
  taxAmount?: string | number | null;
  invoiceDate: string;
  dueDate?: string | null;
  userId: number;
}

/**
 * Recognise a customer invoice: revenue earned, and a receivable owed to us.
 */
export async function postCustomerInvoice(input: CustomerInvoiceInput): Promise<any> {
  const net = moneyRound(money(String(input.netAmount)));
  const tax = moneyRound(money(String(input.taxAmount ?? '0')));
  const gross = moneyRound(net.plus(tax));

  if (net.lessThanOrEqualTo(0)) {
    throw new ReceivablesError('INVALID_AMOUNT', 'An invoice must recognise a positive revenue amount.');
  }
  if (tax.isNegative()) {
    throw new ReceivablesError('INVALID_AMOUNT', 'Tax on an invoice cannot be negative.');
  }

  return dbTransaction(async (conn: any) => {
    const [invRows] = await conn.execute(
      'SELECT id, invoice_number, so_id FROM invoices WHERE id = ? FOR UPDATE',
      [input.invoiceId]
    );
    const invoice = (invRows as any[])[0];
    if (!invoice) throw new ReceivablesError('INVOICE_NOT_FOUND', `Invoice ${input.invoiceId} not found.`);

    // one receivable per invoice; a retry returns the original result
    const [existing] = await conn.execute(
      'SELECT id, journal_entry_id FROM accounts_receivable WHERE invoice_id = ? FOR UPDATE',
      [input.invoiceId]
    );
    if ((existing as any[]).length > 0) {
      const prior = (existing as any[])[0];
      return { ar_id: prior.id, journal_id: prior.journal_entry_id, replay: true };
    }

    const [arResult] = await conn.execute(
      `INSERT INTO accounts_receivable
       (invoice_id, so_id, customer_id, amount, paid_amount, status, due_date, posted_at)
       VALUES (?, ?, ?, ?, 0, 'open', ?, NOW())`,
      [input.invoiceId, invoice.so_id || null, input.customerId, toDbString(gross), input.dueDate || null]
    );
    const arId = arResult.insertId;

    const arAccount = await resolveAccountByRole(conn, 'AR_CONTROL', {}, input.invoiceDate);
    const revenueAccount = await resolveAccountByRole(conn, 'SALES_REVENUE_PRODUCT', {}, input.invoiceDate);

    const lines: JournalLineInput[] = [
      {
        accountId: arAccount.accountId,
        description: `Invoice ${invoice.invoice_number} receivable`,
        debit: toDbString(gross),
        credit: '0',
        customerId: input.customerId,
      },
      {
        accountId: revenueAccount.accountId,
        description: `Invoice ${invoice.invoice_number} revenue`,
        debit: '0',
        credit: toDbString(net),
        customerId: input.customerId,
      },
    ];

    if (tax.greaterThan(0)) {
      const taxAccount = await resolveAccountByRole(conn, 'OUTPUT_TAX', {}, input.invoiceDate);
      lines.push({
        accountId: taxAccount.accountId,
        description: `Invoice ${invoice.invoice_number} output tax`,
        debit: '0',
        credit: toDbString(tax),
        customerId: input.customerId,
      });
    }

    const journal = await postSystemJournal(conn, {
      sourceModule: 'SALES',
      sourceType: 'customer_invoice',
      sourceId: input.invoiceId,
      sourceEventType: 'CUSTOMER_INVOICE_POSTED',
      businessDate: input.invoiceDate,
      description: `Invoice ${invoice.invoice_number}`,
      lines,
      idempotencyKey: `customer-invoice-${input.invoiceId}`,
      userId: input.userId,
    });

    await conn.execute('UPDATE accounts_receivable SET journal_entry_id = ? WHERE id = ?', [journal.journal_id, arId]);
    await conn.execute('UPDATE invoices SET customer_id = COALESCE(customer_id, ?), posted_at = NOW() WHERE id = ?', [
      input.customerId,
      input.invoiceId,
    ]);

    return { ar_id: arId, journal_id: journal.journal_id, amount: toDbString(gross) };
  });
}

export interface CustomerReceiptInput {
  invoiceId: number;
  amount: string | number;
  receiptDate: string;
  receiptAccountRole?: 'BANK_OPERATING' | 'CASH_ON_HAND';
  reference?: string | null;
  idempotencyKey: string;
  userId: number;
}

/**
 * Settle part or all of a receivable, turning it into cash.
 */
export async function postCustomerReceipt(input: CustomerReceiptInput): Promise<any> {
  const amount = moneyRound(money(String(input.amount)));
  if (amount.lessThanOrEqualTo(0)) {
    throw new ReceivablesError('INVALID_AMOUNT', 'A receipt must have a positive amount.');
  }
  if (!input.idempotencyKey) {
    throw new ReceivablesError('INVALID_AMOUNT', 'A receipt requires an idempotency key.');
  }

  const accountRole = input.receiptAccountRole || 'BANK_OPERATING';

  return dbTransaction(async (conn: any) => {
    const [arRows] = await conn.execute(
      'SELECT id, customer_id, amount, COALESCE(paid_amount, 0) AS paid_amount FROM accounts_receivable WHERE invoice_id = ? FOR UPDATE',
      [input.invoiceId]
    );
    const ar = (arRows as any[])[0];
    if (!ar) {
      throw new ReceivablesError(
        'AR_NOT_FOUND',
        `Invoice ${input.invoiceId} has no receivable; recognise the invoice before receiving against it.`
      );
    }

    const [prior] = await conn.execute(
      'SELECT id, journal_entry_id FROM sales_payments WHERE invoice_id = ? AND idempotency_key = ?',
      [input.invoiceId, input.idempotencyKey]
    );
    if ((prior as any[]).length > 0) {
      const p = (prior as any[])[0];
      return { payment_id: p.id, journal_id: p.journal_entry_id, replay: true };
    }

    const invoiced = moneyRound(money(String(ar.amount)));
    const received = moneyRound(money(String(ar.paid_amount)));
    const newReceived = moneyRound(received.plus(amount));

    if (newReceived.greaterThan(invoiced)) {
      throw new ReceivablesError(
        'OVER_RECEIPT',
        `Receiving ${toDbString(amount)} would take the settled total to ${toDbString(newReceived)} against an invoice of ${toDbString(invoiced)}.`,
        { invoiceId: input.invoiceId, invoiced: toDbString(invoiced), alreadyReceived: toDbString(received) }
      );
    }

    const [payResult] = await conn.execute(
      `INSERT INTO sales_payments
       (invoice_id, customer_id, payment_date, amount, payment_method, reference_number, status, receipt_account_role, idempotency_key)
       VALUES (?, ?, ?, ?, ?, ?, 'received', ?, ?)`,
      [
        input.invoiceId,
        ar.customer_id,
        input.receiptDate,
        toDbString(amount),
        accountRole === 'CASH_ON_HAND' ? 'cash' : 'bank_transfer',
        input.reference || null,
        accountRole,
        input.idempotencyKey,
      ]
    );
    const paymentId = payResult.insertId;

    const status = newReceived.greaterThanOrEqualTo(invoiced) ? 'paid' : 'partial';
    await conn.execute(
      'UPDATE accounts_receivable SET paid_amount = ?, status = ?, payment_date = ? WHERE id = ?',
      [toDbString(newReceived), status, input.receiptDate, ar.id]
    );
    await conn.execute('UPDATE invoices SET status = ? WHERE id = ?', [status, input.invoiceId]);

    const cashAccount = await resolveAccountByRole(conn, accountRole, {}, input.receiptDate);
    const arAccount = await resolveAccountByRole(conn, 'AR_CONTROL', {}, input.receiptDate);

    const lines: JournalLineInput[] = [
      {
        accountId: cashAccount.accountId,
        description: `Receipt for invoice ${input.invoiceId}${input.reference ? ` (${input.reference})` : ''}`,
        debit: toDbString(amount),
        credit: '0',
        customerId: ar.customer_id,
      },
      {
        accountId: arAccount.accountId,
        description: `Receipt for invoice ${input.invoiceId}`,
        debit: '0',
        credit: toDbString(amount),
        customerId: ar.customer_id,
      },
    ];

    const journal = await postSystemJournal(conn, {
      sourceModule: 'SALES',
      sourceType: 'customer_receipt',
      sourceId: paymentId,
      sourceEventType: 'CUSTOMER_RECEIPT_POSTED',
      businessDate: input.receiptDate,
      description: `Receipt for invoice ${input.invoiceId}`,
      lines,
      idempotencyKey: `customer-receipt-${input.invoiceId}-${input.idempotencyKey}`,
      userId: input.userId,
    });

    await conn.execute('UPDATE sales_payments SET journal_entry_id = ? WHERE id = ?', [journal.journal_id, paymentId]);

    return { payment_id: paymentId, journal_id: journal.journal_id, received: toDbString(newReceived), status };
  });
}
