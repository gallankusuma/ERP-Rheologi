import path from 'path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { bootstrapSchema } from '../lib/schemaBootstrap';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Closes the loop that goods receipt opens. Receipt credits GRNI; this proves the vendor
// invoice clears it into a payable, and that paying moves the payable to cash — each once,
// atomically, with the journal that says so.

const DISPOSABLE_PREFIX = 'erp_apcheck_';
const BASELINE = path.resolve(__dirname, '../../database/schema_mysql.sql');
const MIGRATIONS = path.resolve(__dirname, '../../database/migrations');
const BUSINESS_DATE = '2026-03-10';

interface Check { name: string; ok: boolean; detail: string }
const checks: Check[] = [];

function record(name: string, ok: boolean, detail: string) {
  checks.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

function serverConfig() {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: false,
  };
}

// captured before the pool is redirected, so the guard keeps comparing against the real
// application database rather than the throwaway one this script points the pool at
const APPLICATION_DB = process.env.DB_NAME;

function assertDisposable(name: string) {
  if (!name.startsWith(DISPOSABLE_PREFIX)) throw new Error(`Refusing to operate on "${name}"`);
  if (name === APPLICATION_DB) throw new Error('Refusing to operate on the application database');
}

// balance of an account from posted journal lines only
async function balanceOf(conn: any, accountCode: string): Promise<number> {
  const [rows]: any = await conn.query(
    `SELECT COALESCE(SUM(CASE WHEN coa.normal_balance = 'credit'
                              THEN COALESCE(jl.credit,0) - COALESCE(jl.debit,0)
                              ELSE COALESCE(jl.debit,0) - COALESCE(jl.credit,0) END), 0) AS bal
       FROM journal_lines jl
       JOIN journal_entries je ON je.id = jl.journal_entry_id AND je.status = 'posted'
       JOIN chart_of_accounts coa ON coa.id = jl.account_id
      WHERE coa.account_code = ?`,
    [accountCode]
  );
  return Number(rows[0].bal);
}

async function roleAccountCode(conn: any, role: string): Promise<string> {
  const [rows]: any = await conn.query(
    `SELECT coa.account_code FROM account_roles ar JOIN chart_of_accounts coa ON coa.id = ar.account_id
      WHERE ar.role_code = ? LIMIT 1`,
    [role]
  );
  return rows[0]?.account_code;
}

async function main() {
  const dbName = `${DISPOSABLE_PREFIX}${process.pid}_${Date.now()}`;
  assertDisposable(dbName);

  const admin = await mysql.createConnection(serverConfig());
  await admin.query(`CREATE DATABASE \`${dbName}\``);

  let conn: any;
  try {
    conn = await mysql.createConnection({ ...serverConfig(), database: dbName });
    await bootstrapSchema(conn, { baselinePath: BASELINE, migrationDir: MIGRATIONS });

    // the period is seeded by the stream; make sure the one covering the test date is open
    await conn.query(
      `INSERT IGNORE INTO fiscal_periods (period_name, start_date, end_date, fiscal_year, period_number, status)
       VALUES ('2026-03', '2026-03-01', '2026-03-31', 2026, 3, 'open')`
    );
    await conn.query(`UPDATE fiscal_periods SET status = 'open' WHERE ? BETWEEN start_date AND end_date`, [BUSINESS_DATE]);
    await conn.query(`INSERT IGNORE INTO vendors (id, name) VALUES (1, 'PT Mesin Jaya')`);

    const grniCode = await roleAccountCode(conn, 'GRNI');
    const apCode = await roleAccountCode(conn, 'AP_CONTROL');
    const bankCode = await roleAccountCode(conn, 'BANK_OPERATING');
    record('posting roles resolve to accounts', !!(grniCode && apCode && bankCode), `GRNI=${grniCode} AP=${apCode} BANK=${bankCode}`);

    // the service uses the application pool, so point it at the throwaway database
    process.env.DB_NAME = dbName;
    const { postVendorInvoice, postApPayment } = await import('../services/payables.service');

    // stand in for the goods receipt that credited GRNI
    const grniBefore = await balanceOf(conn, grniCode);

    const invoice = await postVendorInvoice({
      vendorId: 1,
      invoiceNumber: 'INV-9001',
      invoiceDate: BUSINESS_DATE,
      amount: '100000000',
      userId: 1,
    });
    record('a vendor invoice posts a journal', !!invoice.journal_id, `ap=${invoice.ap_id}, journal=${invoice.journal_id}`);

    const grniAfter = await balanceOf(conn, grniCode);
    const apAfter = await balanceOf(conn, apCode);
    record(
      'the invoice clears GRNI and raises the payable',
      grniAfter === grniBefore - 100000000 && apAfter === 100000000,
      `GRNI ${grniBefore} -> ${grniAfter}, AP ${apAfter}`
    );

    const replay = await postVendorInvoice({
      vendorId: 1, invoiceNumber: 'INV-9001', invoiceDate: BUSINESS_DATE, amount: '100000000', userId: 1,
    });
    record('the same invoice number replays instead of duplicating', replay.replay === true && replay.ap_id === invoice.ap_id, `ap=${replay.ap_id}`);

    try {
      await postVendorInvoice({
        vendorId: 1, invoiceNumber: 'INV-9001', invoiceDate: BUSINESS_DATE, amount: '95000000', userId: 1,
      });
      record('the same number with a different amount is refused', false, 'it was accepted');
    } catch (err: any) {
      record('the same number with a different amount is refused', err.code === 'DUPLICATE_INVOICE', `${err.code} (${err.httpStatus})`);
    }

    // pay half
    const part = await postApPayment({
      apId: invoice.ap_id, amount: '40000000', paymentDate: BUSINESS_DATE,
      idempotencyKey: 'pay-1', userId: 1,
    });
    record('a partial payment leaves the payable partly settled', part.status === 'partial', `paid=${part.paid_amount}, status=${part.status}`);

    const apMid = await balanceOf(conn, apCode);
    const bankMid = await balanceOf(conn, bankCode);
    record(
      'payment moves the liability to cash',
      apMid === 60000000 && bankMid === -40000000,
      `AP ${apMid}, bank ${bankMid}`
    );

    const payReplay = await postApPayment({
      apId: invoice.ap_id, amount: '40000000', paymentDate: BUSINESS_DATE, idempotencyKey: 'pay-1', userId: 1,
    });
    const apAfterReplay = await balanceOf(conn, apCode);
    record(
      'retrying a payment settles it once',
      payReplay.replay === true && apAfterReplay === 60000000,
      `AP still ${apAfterReplay}`
    );

    try {
      await postApPayment({
        apId: invoice.ap_id, amount: '70000000', paymentDate: BUSINESS_DATE, idempotencyKey: 'pay-over', userId: 1,
      });
      record('paying more than the invoice is refused', false, 'it was accepted');
    } catch (err: any) {
      record('paying more than the invoice is refused', err.code === 'OVER_PAYMENT', `${err.code} (${err.httpStatus})`);
    }

    const rest = await postApPayment({
      apId: invoice.ap_id, amount: '60000000', paymentDate: BUSINESS_DATE, idempotencyKey: 'pay-2', userId: 1,
    });
    const apFinal = await balanceOf(conn, apCode);
    record('settling the balance closes the payable', rest.status === 'paid' && apFinal === 0, `status=${rest.status}, AP=${apFinal}`);

    // every journal written here must balance
    const [unbalanced]: any = await conn.query(
      `SELECT COUNT(*) AS n FROM journal_entries WHERE status = 'posted' AND total_debit <> total_credit`
    );
    record('every posted journal balances', Number(unbalanced[0].n) === 0, `unbalanced=${unbalanced[0].n}`);
  } catch (err: any) {
    record('payables check completed without unexpected error', false, err.message);
  } finally {
    if (conn) await conn.end();
    assertDisposable(dbName);
    await admin.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
    await admin.end();
  }

  const failed = checks.filter(c => !c.ok);
  console.log('');
  console.log(`Result: ${checks.length - failed.length}/${checks.length} checks passed`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(err => {
  console.error('Payables check crashed:', err);
  process.exit(1);
});
