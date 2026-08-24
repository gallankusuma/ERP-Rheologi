// AccountingPostingService
// the only authority that creates posted journals in the system
// blueprint §12: atomic transaction contract

import crypto from 'crypto';
import { money, moneyRound, assertBalanced, fromDb, toDbString, Decimal } from '../lib/decimal';
import { nextEntryNumber } from './journal-sequence.service';
import { lockPostingPeriod } from './fiscal-period.service';

// journal line input
export interface JournalLineInput {
  accountId: number;
  description?: string;
  debit: string;     // decimal string
  credit: string;    // decimal string
  currency?: string;
  exchangeRate?: string;
  costCenterId?: number;
  projectId?: number;
  productId?: number;
  warehouseId?: number;
  lotId?: number;
  vendorId?: number;
  customerId?: number;
  sourceLineRef?: string;
}

// manual journal create input
export interface CreateManualJournalInput {
  entryDate: string;
  description: string;
  lines: JournalLineInput[];
  transactionCurrency?: string;
  idempotencyKey: string;
  userId: number;
}

// submit/approve/post/reverse input
export interface JournalCommandInput {
  journalId: number;
  userId: number;
  idempotencyKey: string;
  reason?: string;
}

// system posting input (from operational modules)
export interface SystemPostingInput {
  sourceModule: string;
  sourceType: string;
  sourceId: number;
  sourceLineId?: number;
  sourceEventType: string;
  businessDate: string;
  description: string;
  lines: JournalLineInput[];
  transactionCurrency?: string;
  idempotencyKey: string;
  userId: number;
}

// compute content hash for a set of journal lines
function computeContentHash(description: string, lines: JournalLineInput[]): string {
  const canonical = JSON.stringify({
    description,
    lines: lines.map(l => ({
      accountId: l.accountId,
      debit: l.debit,
      credit: l.credit,
      currency: l.currency || 'IDR',
    })).sort((a, b) => a.accountId - b.accountId),
  });
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

// compute payload hash for idempotency
function computePayloadHash(payload: any): string {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

// validate journal lines before persistence
function validateLines(lines: JournalLineInput[]): void {
  if (!lines || lines.length < 2) {
    throw Object.assign(
      new Error('A journal must have at least two lines'),
      { statusCode: 422, code: 'JOURNAL_UNBALANCED' }
    );
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const debit = money(line.debit || '0');
    const credit = money(line.credit || '0');

    if (debit.isNegative()) {
      throw Object.assign(
        new Error(`Line ${i + 1}: debit cannot be negative`),
        { statusCode: 422, code: 'INVALID_AMOUNT' }
      );
    }
    if (credit.isNegative()) {
      throw Object.assign(
        new Error(`Line ${i + 1}: credit cannot be negative`),
        { statusCode: 422, code: 'INVALID_AMOUNT' }
      );
    }
    if (debit.isZero() && credit.isZero()) {
      throw Object.assign(
        new Error(`Line ${i + 1}: either debit or credit must be positive`),
        { statusCode: 422, code: 'INVALID_AMOUNT' }
      );
    }
    if (debit.greaterThan(0) && credit.greaterThan(0)) {
      throw Object.assign(
        new Error(`Line ${i + 1}: a line cannot have both debit and credit`),
        { statusCode: 422, code: 'INVALID_AMOUNT' }
      );
    }
    if (!line.accountId) {
      throw Object.assign(
        new Error(`Line ${i + 1}: accountId is required`),
        { statusCode: 422, code: 'MISSING_ACCOUNT' }
      );
    }
  }

  // verify balanced
  let totalDebit = money('0');
  let totalCredit = money('0');
  for (const line of lines) {
    totalDebit = totalDebit.plus(money(line.debit || '0'));
    totalCredit = totalCredit.plus(money(line.credit || '0'));
  }
  assertBalanced(moneyRound(totalDebit), moneyRound(totalCredit));
}

// validate accounts: must exist, be active, be postable, not header
async function validateAccounts(conn: any, lines: JournalLineInput[], allowControlManual: boolean = false): Promise<void> {
  const accountIds = [...new Set(lines.map(l => l.accountId))];

  const placeholders = accountIds.map(() => '?').join(',');
  const [rows] = await conn.execute(
    `SELECT id, account_code, account_name, is_active, is_postable, is_header,
            is_control_account, allow_manual_posting
     FROM chart_of_accounts WHERE id IN (${placeholders})`,
    accountIds
  );
  const accountMap = new Map<number, any>();
  for (const row of rows as any[]) {
    accountMap.set(row.id, row);
  }

  for (const line of lines) {
    const acct = accountMap.get(line.accountId);
    if (!acct) {
      throw Object.assign(
        new Error(`Account ID ${line.accountId} not found`),
        { statusCode: 404, code: 'ACCOUNT_NOT_FOUND' }
      );
    }
    if (!acct.is_active) {
      throw Object.assign(
        new Error(`Account ${acct.account_code} ${acct.account_name} is inactive`),
        { statusCode: 422, code: 'ACCOUNT_INACTIVE' }
      );
    }
    if (acct.is_header) {
      throw Object.assign(
        new Error(`Account ${acct.account_code} is a header account and cannot receive journal entries`),
        { statusCode: 422, code: 'ACCOUNT_NOT_POSTABLE' }
      );
    }
    if (!acct.is_postable) {
      throw Object.assign(
        new Error(`Account ${acct.account_code} is not postable`),
        { statusCode: 422, code: 'ACCOUNT_NOT_POSTABLE' }
      );
    }
    if (acct.is_control_account && !acct.allow_manual_posting && !allowControlManual) {
      throw Object.assign(
        new Error(`Account ${acct.account_code} is a control account and does not allow manual posting`),
        { statusCode: 422, code: 'CONTROL_ACCOUNT_MANUAL_DENIED' }
      );
    }
  }
}

// check idempotency: return stored outcome or detect mismatch
async function checkIdempotency(
  conn: any, scope: string, key: string, payloadHash: string, companyId: number = 1
): Promise<{ replay: boolean; outcome?: any }> {
  const [rows] = await conn.execute(
    `SELECT http_status, response_body, payload_hash FROM idempotency_outcomes
     WHERE company_id = ? AND command_scope = ? AND idempotency_key = ?`,
    [companyId, scope, key]
  );
  if ((rows as any[]).length === 0) return { replay: false };

  const existing = (rows as any[])[0];
  if (existing.payload_hash !== payloadHash) {
    throw Object.assign(
      new Error('Idempotency key already used with different payload'),
      { statusCode: 409, code: 'IDEMPOTENCY_MISMATCH' }
    );
  }

  // replay: return original response
  return {
    replay: true,
    outcome: {
      status: existing.http_status,
      body: typeof existing.response_body === 'string'
        ? JSON.parse(existing.response_body)
        : existing.response_body,
    },
  };
}

// store idempotency outcome
async function storeIdempotency(
  conn: any, scope: string, key: string, payloadHash: string,
  httpStatus: number, responseBody: any,
  eventId: number | null, journalId: number | null,
  companyId: number = 1
): Promise<void> {
  await conn.execute(
    `INSERT INTO idempotency_outcomes
     (company_id, command_scope, idempotency_key, payload_hash, http_status, response_body, accounting_event_id, journal_entry_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [companyId, scope, key, payloadHash, httpStatus, JSON.stringify(responseBody), eventId, journalId]
  );
}

// create a manual journal (DRAFT status)
export async function createManualJournal(conn: any, input: CreateManualJournalInput): Promise<any> {
  const payloadHash = computePayloadHash({ description: input.description, lines: input.lines, entryDate: input.entryDate });

  // idempotency check
  const idem = await checkIdempotency(conn, 'MANUAL_JOURNAL_CREATE', input.idempotencyKey, payloadHash);
  if (idem.replay) return idem.outcome!.body;

  // validate lines
  validateLines(input.lines);

  // validate accounts (manual journal: control accounts blocked by default)
  await validateAccounts(conn, input.lines, false);

  // compute totals
  let totalDebit = money('0');
  let totalCredit = money('0');
  for (const line of input.lines) {
    totalDebit = totalDebit.plus(money(line.debit || '0'));
    totalCredit = totalCredit.plus(money(line.credit || '0'));
  }
  totalDebit = moneyRound(totalDebit);
  totalCredit = moneyRound(totalCredit);

  const contentHash = computeContentHash(input.description, input.lines);
  const entryNumber = await nextEntryNumber(conn, 'MANUAL');
  const currency = input.transactionCurrency || 'IDR';

  // insert journal header
  const [headerResult] = await conn.execute(
    `INSERT INTO journal_entries
     (entry_number, entry_date, description, journal_type, status,
      total_debit, total_credit, transaction_currency, base_currency,
      content_hash, idempotency_key, created_by, created_at)
     VALUES (?, ?, ?, 'MANUAL', 'draft', ?, ?, ?, 'IDR', ?, ?, ?, NOW())`,
    [entryNumber, input.entryDate, input.description,
     toDbString(totalDebit), toDbString(totalCredit),
     currency, contentHash, input.idempotencyKey, input.userId]
  );
  const journalId = headerResult.insertId;

  // find fiscal period (non-blocking for draft)
  let periodId: number | null = null;
  try {
    const period = await lockPostingPeriod(conn, input.entryDate, 'MANUAL');
    periodId = period.id;
  } catch {
    // draft can be created without an open period; posting will enforce it
  }

  if (periodId) {
    await conn.execute('UPDATE journal_entries SET fiscal_period_id = ? WHERE id = ?', [periodId, journalId]);
  }

  // insert journal lines
  for (let i = 0; i < input.lines.length; i++) {
    const line = input.lines[i];
    const debit = moneyRound(money(line.debit || '0'));
    const credit = moneyRound(money(line.credit || '0'));
    const rate = money(line.exchangeRate || '1');
    const baseDebit = moneyRound(debit.times(rate));
    const baseCredit = moneyRound(credit.times(rate));

    await conn.execute(
      `INSERT INTO journal_lines
       (journal_entry_id, line_number, account_id, description,
        debit, credit, currency, exchange_rate, base_debit, base_credit,
        cost_center_id, project_id, product_id, warehouse_id, lot_id,
        vendor_id, customer_id, source_line_ref)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [journalId, i + 1, line.accountId, line.description || null,
       toDbString(debit), toDbString(credit),
       line.currency || currency,
       toDbString(rate, 10),
       toDbString(baseDebit), toDbString(baseCredit),
       line.costCenterId || null, line.projectId || null,
       line.productId || null, line.warehouseId || null, line.lotId || null,
       line.vendorId || null, line.customerId || null, line.sourceLineRef || null]
    );
  }

  const response = {
    id: journalId,
    entry_number: entryNumber,
    status: 'draft',
    journal_type: 'MANUAL',
    total_debit: toDbString(totalDebit),
    total_credit: toDbString(totalCredit),
    line_count: input.lines.length,
  };

  await storeIdempotency(conn, 'MANUAL_JOURNAL_CREATE', input.idempotencyKey, payloadHash, 201, response, null, journalId);
  return response;
}

// submit journal for approval (DRAFT -> PENDING_APPROVAL)
export async function submitJournal(conn: any, input: JournalCommandInput): Promise<any> {
  const [rows] = await conn.execute(
    'SELECT id, status, content_hash, created_by FROM journal_entries WHERE id = ? FOR UPDATE',
    [input.journalId]
  );
  const journal = (rows as any[])[0];
  if (!journal) {
    throw Object.assign(new Error('Journal not found'), { statusCode: 404, code: 'JOURNAL_NOT_FOUND' });
  }
  if (journal.status !== 'draft') {
    throw Object.assign(
      new Error(`Journal is ${journal.status}, expected draft for submit`),
      { statusCode: 409, code: 'INVALID_STATUS_TRANSITION' }
    );
  }

  await conn.execute(
    "UPDATE journal_entries SET status = 'pending_approval' WHERE id = ?",
    [input.journalId]
  );

  return { id: input.journalId, status: 'pending_approval' };
}

// approve journal (PENDING_APPROVAL -> APPROVED)
// SoD: approver must not be the maker
export async function approveJournal(conn: any, input: JournalCommandInput): Promise<any> {
  const [rows] = await conn.execute(
    'SELECT id, status, created_by FROM journal_entries WHERE id = ? FOR UPDATE',
    [input.journalId]
  );
  const journal = (rows as any[])[0];
  if (!journal) {
    throw Object.assign(new Error('Journal not found'), { statusCode: 404, code: 'JOURNAL_NOT_FOUND' });
  }
  if (journal.status !== 'pending_approval') {
    throw Object.assign(
      new Error(`Journal is ${journal.status}, expected pending_approval for approve`),
      { statusCode: 409, code: 'INVALID_STATUS_TRANSITION' }
    );
  }

  // SoD check: approver != maker
  if (journal.created_by === input.userId) {
    throw Object.assign(
      new Error('Segregation of duties: approver cannot be the journal maker'),
      { statusCode: 403, code: 'SOD_VIOLATION' }
    );
  }

  await conn.execute(
    "UPDATE journal_entries SET status = 'approved', approver_id = ?, approved_at = NOW() WHERE id = ?",
    [input.userId, input.journalId]
  );

  return { id: input.journalId, status: 'approved' };
}

// post journal (APPROVED -> POSTED)
// SoD: poster should not be the maker
export async function postJournal(conn: any, input: JournalCommandInput): Promise<any> {
  const payloadHash = computePayloadHash({ journalId: input.journalId, action: 'post' });

  const idem = await checkIdempotency(conn, 'JOURNAL_POST', input.idempotencyKey, payloadHash);
  if (idem.replay) return idem.outcome!.body;

  const [rows] = await conn.execute(
    `SELECT id, status, entry_date, fiscal_period_id, created_by, approver_id,
            total_debit, total_credit, journal_type
     FROM journal_entries WHERE id = ? FOR UPDATE`,
    [input.journalId]
  );
  const journal = (rows as any[])[0];
  if (!journal) {
    throw Object.assign(new Error('Journal not found'), { statusCode: 404, code: 'JOURNAL_NOT_FOUND' });
  }
  if (journal.status === 'posted') {
    // already posted — idempotent success
    return { id: input.journalId, status: 'posted', message: 'Already posted' };
  }
  if (journal.status !== 'approved') {
    throw Object.assign(
      new Error(`Journal is ${journal.status}, expected approved for posting`),
      { statusCode: 409, code: 'INVALID_STATUS_TRANSITION' }
    );
  }

  // SoD check: poster != maker
  if (journal.created_by === input.userId) {
    throw Object.assign(
      new Error('Segregation of duties: poster cannot be the journal maker'),
      { statusCode: 403, code: 'SOD_VIOLATION' }
    );
  }

  // validate period
  const postingDate = journal.entry_date;
  const period = await lockPostingPeriod(conn, postingDate, 'MANUAL');

  // re-validate balance from persisted lines
  const [lineRows] = await conn.execute(
    'SELECT base_debit, base_credit FROM journal_lines WHERE journal_entry_id = ?',
    [input.journalId]
  );
  let totalDebit = money('0');
  let totalCredit = money('0');
  for (const line of lineRows as any[]) {
    totalDebit = totalDebit.plus(fromDb(line.base_debit));
    totalCredit = totalCredit.plus(fromDb(line.base_credit));
  }
  assertBalanced(moneyRound(totalDebit), moneyRound(totalCredit));

  // post
  await conn.execute(
    `UPDATE journal_entries SET status = 'posted', posting_date = ?, fiscal_period_id = ?,
     posted_by = ?, posted_at = NOW() WHERE id = ?`,
    [postingDate, period.id, input.userId, input.journalId]
  );

  const response = {
    id: input.journalId,
    status: 'posted',
    posting_date: postingDate,
    fiscal_period: period.period_name,
  };

  await storeIdempotency(conn, 'JOURNAL_POST', input.idempotencyKey, payloadHash, 200, response, null, input.journalId);
  return response;
}

// reverse a posted journal (creates a new opposite journal)
// the original journal remains POSTED and immutable
export async function reverseJournal(conn: any, input: JournalCommandInput): Promise<any> {
  const payloadHash = computePayloadHash({ journalId: input.journalId, action: 'reverse' });

  const idem = await checkIdempotency(conn, 'JOURNAL_REVERSE', input.idempotencyKey, payloadHash);
  if (idem.replay) return idem.outcome!.body;

  // lock original
  const [rows] = await conn.execute(
    `SELECT id, entry_number, status, entry_date, description, journal_type,
            transaction_currency, base_currency, total_debit, total_credit,
            created_by, reversal_journal_id
     FROM journal_entries WHERE id = ? FOR UPDATE`,
    [input.journalId]
  );
  const original = (rows as any[])[0];
  if (!original) {
    throw Object.assign(new Error('Journal not found'), { statusCode: 404, code: 'JOURNAL_NOT_FOUND' });
  }
  if (original.status !== 'posted') {
    throw Object.assign(
      new Error(`Journal is ${original.status}, only posted journals can be reversed`),
      { statusCode: 409, code: 'INVALID_STATUS_TRANSITION' }
    );
  }
  if (original.reversal_journal_id) {
    throw Object.assign(
      new Error('Journal has already been reversed'),
      { statusCode: 409, code: 'ALREADY_REVERSED' }
    );
  }

  if (!input.reason || input.reason.trim().length < 5) {
    throw Object.assign(
      new Error('Reversal reason is required (min 5 characters)'),
      { statusCode: 422, code: 'MISSING_REVERSAL_REASON' }
    );
  }

  // determine reversal posting date (today, must be in open period)
  const reversalDate = new Date().toISOString().slice(0, 10);
  const period = await lockPostingPeriod(conn, reversalDate, 'MANUAL');

  // create reversal journal
  const reversalNumber = await nextEntryNumber(conn, 'REVERSAL');

  const [revResult] = await conn.execute(
    `INSERT INTO journal_entries
     (entry_number, entry_date, posting_date, fiscal_period_id, description, journal_type, status,
      total_debit, total_credit, transaction_currency, base_currency,
      original_journal_id, idempotency_key, created_by, posted_by, posted_at, created_at)
     VALUES (?, ?, ?, ?, ?, 'REVERSAL', 'posted', ?, ?, ?, 'IDR', ?, ?, ?, ?, NOW(), NOW())`,
    [reversalNumber, reversalDate, reversalDate, period.id,
     `Reversal of ${original.entry_number}: ${input.reason}`,
     toDbString(fromDb(original.total_debit)),
     toDbString(fromDb(original.total_credit)),
     original.transaction_currency || 'IDR',
     input.journalId, input.idempotencyKey, input.userId, input.userId]
  );
  const reversalId = revResult.insertId;

  // copy lines with debit/credit swapped
  const [origLines] = await conn.execute(
    `SELECT line_number, account_id, description, debit, credit, currency, exchange_rate,
            base_debit, base_credit, cost_center_id, project_id, product_id,
            warehouse_id, lot_id, vendor_id, customer_id, source_line_ref
     FROM journal_lines WHERE journal_entry_id = ? ORDER BY line_number`,
    [input.journalId]
  );

  for (const line of origLines as any[]) {
    await conn.execute(
      `INSERT INTO journal_lines
       (journal_entry_id, line_number, account_id, description,
        debit, credit, currency, exchange_rate, base_debit, base_credit,
        cost_center_id, project_id, product_id, warehouse_id, lot_id,
        vendor_id, customer_id, source_line_ref)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [reversalId, line.line_number, line.account_id,
       `Reversal: ${line.description || ''}`,
       toDbString(fromDb(line.credit)),    // swap: original credit -> reversal debit
       toDbString(fromDb(line.debit)),     // swap: original debit -> reversal credit
       line.currency, line.exchange_rate,
       toDbString(fromDb(line.base_credit)), // swap base amounts too
       toDbString(fromDb(line.base_debit)),
       line.cost_center_id, line.project_id, line.product_id,
       line.warehouse_id, line.lot_id,
       line.vendor_id, line.customer_id, line.source_line_ref]
    );
  }

  // mark original as reversed (immutable: status stays POSTED, just add link)
  await conn.execute(
    `UPDATE journal_entries SET reversal_journal_id = ?, reversed_by = ?, reversed_at = NOW(),
     reversal_reason = ? WHERE id = ?`,
    [reversalId, input.userId, input.reason, input.journalId]
  );

  const response = {
    original_journal_id: input.journalId,
    reversal_journal_id: reversalId,
    reversal_entry_number: reversalNumber,
    reversal_date: reversalDate,
    fiscal_period: period.period_name,
    reason: input.reason,
  };

  await storeIdempotency(conn, 'JOURNAL_REVERSE', input.idempotencyKey, payloadHash, 201, response, null, reversalId);
  return response;
}

// create and post a system journal from an operational event
// used by AccountingPostingService for GRN, material issue, FG receipt, shipment, etc.
export async function postSystemJournal(conn: any, input: SystemPostingInput): Promise<any> {
  const payloadHash = computePayloadHash({
    sourceModule: input.sourceModule, sourceType: input.sourceType,
    sourceId: input.sourceId, sourceLineId: input.sourceLineId,
    lines: input.lines,
  });

  const idem = await checkIdempotency(conn, `SYSTEM_${input.sourceEventType}`, input.idempotencyKey, payloadHash);
  if (idem.replay) return idem.outcome!.body;

  // validate
  validateLines(input.lines);
  await validateAccounts(conn, input.lines, true); // system postings allowed on control accounts

  // period
  const period = await lockPostingPeriod(conn, input.businessDate, 'SYSTEM');

  // compute totals
  let totalDebit = money('0');
  let totalCredit = money('0');
  for (const line of input.lines) {
    totalDebit = totalDebit.plus(money(line.debit || '0'));
    totalCredit = totalCredit.plus(money(line.credit || '0'));
  }
  totalDebit = moneyRound(totalDebit);
  totalCredit = moneyRound(totalCredit);

  // create accounting event
  const eventUuid = crypto.randomUUID();
  const sourceHash = computePayloadHash({ sourceId: input.sourceId, sourceLineId: input.sourceLineId });

  const [eventResult] = await conn.execute(
    `INSERT INTO accounting_events
     (event_uuid, company_id, source_module, source_type, source_id, source_line_id,
      source_event_type, source_business_date, source_hash, status, created_by)
     VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, 'RECEIVED', ?)`,
    [eventUuid, input.sourceModule, input.sourceType, input.sourceId,
     input.sourceLineId || null, input.sourceEventType,
     input.businessDate, sourceHash, input.userId]
  );
  const eventId = eventResult.insertId;

  // create journal
  const entryNumber = await nextEntryNumber(conn, 'SYSTEM');
  const contentHash = computeContentHash(input.description, input.lines);
  const currency = input.transactionCurrency || 'IDR';

  const [headerResult] = await conn.execute(
    `INSERT INTO journal_entries
     (entry_number, entry_date, posting_date, fiscal_period_id, description,
      journal_type, status, total_debit, total_credit,
      transaction_currency, base_currency, accounting_event_id,
      reference_type, reference_id, content_hash, idempotency_key,
      created_by, posted_by, posted_at, created_at)
     VALUES (?, ?, ?, ?, ?, 'SYSTEM', 'posted', ?, ?, ?, 'IDR', ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [entryNumber, input.businessDate, input.businessDate, period.id,
     input.description, toDbString(totalDebit), toDbString(totalCredit),
     currency, eventId, input.sourceType, input.sourceId,
     contentHash, input.idempotencyKey, input.userId, input.userId]
  );
  const journalId = headerResult.insertId;

  // insert lines
  for (let i = 0; i < input.lines.length; i++) {
    const line = input.lines[i];
    const debit = moneyRound(money(line.debit || '0'));
    const credit = moneyRound(money(line.credit || '0'));
    const rate = money(line.exchangeRate || '1');
    const baseDebit = moneyRound(debit.times(rate));
    const baseCredit = moneyRound(credit.times(rate));

    await conn.execute(
      `INSERT INTO journal_lines
       (journal_entry_id, line_number, account_id, description,
        debit, credit, currency, exchange_rate, base_debit, base_credit,
        cost_center_id, project_id, product_id, warehouse_id, lot_id,
        vendor_id, customer_id, source_line_ref)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [journalId, i + 1, line.accountId, line.description || null,
       toDbString(debit), toDbString(credit),
       line.currency || currency,
       toDbString(rate, 10),
       toDbString(baseDebit), toDbString(baseCredit),
       line.costCenterId || null, line.projectId || null,
       line.productId || null, line.warehouseId || null, line.lotId || null,
       line.vendorId || null, line.customerId || null, line.sourceLineRef || null]
    );
  }

  // update accounting event to POSTED
  await conn.execute(
    "UPDATE accounting_events SET status = 'POSTED', journal_entry_id = ? WHERE id = ?",
    [journalId, eventId]
  );

  const response = {
    event_id: eventId,
    event_uuid: eventUuid,
    journal_id: journalId,
    entry_number: entryNumber,
    status: 'posted',
    posting_date: input.businessDate,
    fiscal_period: period.period_name,
    total_debit: toDbString(totalDebit),
    total_credit: toDbString(totalCredit),
  };

  await storeIdempotency(
    conn, `SYSTEM_${input.sourceEventType}`, input.idempotencyKey,
    payloadHash, 200, response, eventId, journalId
  );

  return response;
}

export interface StatisticalEventInput {
  sourceModule: string;
  sourceType: string;
  sourceId: number;
  sourceLineId?: number;
  sourceEventType: string;
  businessDate: string;
  description: string;
  postingProfileId?: number;
  idempotencyKey: string;
  userId: number;
}

/**
 * Record a stock event that carries no monetary value, approved by a posting profile.
 * No journal is written because a zero-amount line is not a valid journal line; the
 * accounting event preserves the lineage so the movement is never financially invisible.
 */
export async function postStatisticalEvent(conn: any, input: StatisticalEventInput): Promise<any> {
  const payloadHash = computePayloadHash({
    sourceModule: input.sourceModule,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    sourceLineId: input.sourceLineId,
    statistical: true,
  });

  const idem = await checkIdempotency(conn, `SYSTEM_${input.sourceEventType}`, input.idempotencyKey, payloadHash);
  if (idem.replay) return idem.outcome!.body;

  // a statistical event still belongs to an open period: a closed period must not receive
  // new events of any kind
  const period = await lockPostingPeriod(conn, input.businessDate, 'SYSTEM');

  const eventUuid = crypto.randomUUID();
  const sourceHash = computePayloadHash({ sourceId: input.sourceId, sourceLineId: input.sourceLineId });

  const [eventResult] = await conn.execute(
    `INSERT INTO accounting_events
     (event_uuid, company_id, source_module, source_type, source_id, source_line_id,
      source_event_type, source_business_date, source_hash, posting_profile_id, status, created_by)
     VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, 'STATISTICAL', ?)`,
    [eventUuid, input.sourceModule, input.sourceType, input.sourceId,
     input.sourceLineId || null, input.sourceEventType,
     input.businessDate, sourceHash, input.postingProfileId || null, input.userId]
  );
  const eventId = eventResult.insertId;

  const body = {
    accounting_event_id: eventId,
    journal_id: null,
    statistical: true,
    description: input.description,
  };

  await storeIdempotency(conn, `SYSTEM_${input.sourceEventType}`, input.idempotencyKey, payloadHash, 201, body, eventId, null);

  return body;
}
