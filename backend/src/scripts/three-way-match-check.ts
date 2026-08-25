import path from 'path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { bootstrapSchema } from '../lib/schemaBootstrap';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Three-way match: the order, the receipt and the invoice must agree before a payable exists.
//
// The control is only worth having if it refuses. Each check here bills a real receipt line
// and then tries the ways a vendor invoice can be wrong — more than arrived, the same delivery
// twice, someone else's goods, a price nobody agreed — and expects a refusal with its own code
// rather than a posted liability.

const DISPOSABLE_PREFIX = 'erp_3wmcheck_';
const BASELINE = path.resolve(__dirname, '../../database/schema_mysql.sql');
const MIGRATIONS = path.resolve(__dirname, '../../database/migrations');
const BUSINESS_DATE = '2026-03-12';

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

/** run a call that must be refused, and check it is refused for the stated reason */
async function expectRefused(label: string, expected: string, run: () => Promise<any>) {
  try {
    await run();
    record(label, false, 'it was accepted');
  } catch (err: any) {
    record(label, err.code === expected, `${err.code} (${err.httpStatus})`);
  }
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

    await conn.query(
      `INSERT IGNORE INTO fiscal_periods (period_name, start_date, end_date, fiscal_year, period_number, status)
       VALUES ('2026-03', '2026-03-01', '2026-03-31', 2026, 3, 'open')`
    );
    await conn.query(`UPDATE fiscal_periods SET status = 'open' WHERE ? BETWEEN start_date AND end_date`, [BUSINESS_DATE]);

    // two vendors, so "someone else's delivery" can actually be tried
    await conn.query(
      `INSERT IGNORE INTO vendors (id, code, name) VALUES (1, 'V-001', 'PT Kimia Utama'), (2, 'V-002', 'PT Lain Sendiri')`
    );
    await conn.query(`INSERT IGNORE INTO warehouses (id, code, name) VALUES (1, 'WH-RM', 'Raw Material')`);
    await conn.query(`INSERT IGNORE INTO products (id, sku, name, unit_of_measure_id) VALUES (1, 'RM-1', 'Resin', 1)`);

    // ordered 100 at 10,000
    await conn.query(
      `INSERT INTO purchase_orders (id, po_number, vendor_id, po_date, status, total_amount)
       VALUES (1, 'PO-3W-1', 1, ?, 'APPROVED', 1000000)`,
      [BUSINESS_DATE]
    );
    await conn.query(
      `INSERT INTO purchase_order_items (id, purchase_order_id, product_id, quantity, unit_price, line_total)
       VALUES (1, 1, 1, 100, 10000, 1000000)`
    );

    // 60 actually turned up, accrued into GRNI at the agreed price
    await conn.query(
      `INSERT INTO goods_receipts (id, grn_number, po_id, warehouse_id, received_date, status)
       VALUES (1, 'GRN-3W-1', 1, 1, ?, 'APPROVED')`,
      [BUSINESS_DATE]
    );
    await conn.query(
      `INSERT INTO grn_lines (id, grn_id, po_item_id, product_id, quantity_received, unit_cost)
       VALUES (1, 1, 1, 1, 60, 10000)`
    );

    // a second vendor's delivery, to prove an invoice cannot reach across
    await conn.query(
      `INSERT INTO purchase_orders (id, po_number, vendor_id, po_date, status, total_amount)
       VALUES (2, 'PO-3W-2', 2, ?, 'APPROVED', 50000)`,
      [BUSINESS_DATE]
    );
    await conn.query(
      `INSERT INTO purchase_order_items (id, purchase_order_id, product_id, quantity, unit_price, line_total)
       VALUES (2, 2, 1, 5, 10000, 50000)`
    );
    await conn.query(
      `INSERT INTO goods_receipts (id, grn_number, po_id, warehouse_id, received_date, status)
       VALUES (2, 'GRN-3W-2', 2, 1, ?, 'APPROVED')`,
      [BUSINESS_DATE]
    );
    await conn.query(
      `INSERT INTO grn_lines (id, grn_id, po_item_id, product_id, quantity_received, unit_cost)
       VALUES (2, 2, 2, 1, 5, 10000)`
    );

    const grniCode = await roleAccountCode(conn, 'GRNI');
    const apCode = await roleAccountCode(conn, 'AP_CONTROL');
    const ppvCode = await roleAccountCode(conn, 'PURCHASE_PRICE_VARIANCE');
    record(
      'the variance account is mapped alongside GRNI and AP',
      !!(grniCode && apCode && ppvCode),
      `GRNI=${grniCode} AP=${apCode} PPV=${ppvCode}`
    );

    const [tolerance]: any = await conn.query(
      `SELECT price_tolerance_percent, price_tolerance_absolute FROM accounting_settings LIMIT 1`
    );
    record(
      'a price tolerance is configured rather than assumed',
      Number(tolerance[0]?.price_tolerance_percent) > 0,
      `${tolerance[0]?.price_tolerance_percent}% or ${tolerance[0]?.price_tolerance_absolute}`
    );

    process.env.DB_NAME = dbName;
    const { postVendorInvoice } = await import('../services/payables.service');

    // --- quantity ---------------------------------------------------------------

    await expectRefused(
      'billing more than was received is refused',
      'OVER_BILLED_QUANTITY',
      () => postVendorInvoice({
        vendorId: 1, invoiceNumber: 'INV-OVER', invoiceDate: BUSINESS_DATE, amount: '1000000',
        lines: [{ grnLineId: 1, quantity: '100', unitPrice: '10000' }],
        userId: 1,
      })
    );

    await expectRefused(
      "an invoice cannot bill another vendor's delivery",
      'VENDOR_MISMATCH',
      () => postVendorInvoice({
        vendorId: 1, invoiceNumber: 'INV-CROSS', invoiceDate: BUSINESS_DATE, amount: '50000',
        lines: [{ grnLineId: 2, quantity: '5', unitPrice: '10000' }],
        userId: 1,
      })
    );

    await expectRefused(
      'the same receipt line twice on one invoice is refused',
      'OVER_BILLED_QUANTITY',
      () => postVendorInvoice({
        vendorId: 1, invoiceNumber: 'INV-DUPLINE', invoiceDate: BUSINESS_DATE, amount: '400000',
        lines: [
          { grnLineId: 1, quantity: '20', unitPrice: '10000' },
          { grnLineId: 1, quantity: '20', unitPrice: '10000' },
        ],
        userId: 1,
      })
    );

    await expectRefused(
      'a receipt line that does not exist is refused',
      'GRN_LINE_NOT_FOUND',
      () => postVendorInvoice({
        vendorId: 1, invoiceNumber: 'INV-GHOST', invoiceDate: BUSINESS_DATE, amount: '10000',
        lines: [{ grnLineId: 9999, quantity: '1', unitPrice: '10000' }],
        userId: 1,
      })
    );

    await expectRefused(
      'lines that do not add up to the invoice total are refused',
      'INVOICE_TOTAL_MISMATCH',
      () => postVendorInvoice({
        vendorId: 1, invoiceNumber: 'INV-TOTAL', invoiceDate: BUSINESS_DATE, amount: '999999',
        lines: [{ grnLineId: 1, quantity: '10', unitPrice: '10000' }],
        userId: 1,
      })
    );

    // nothing above may have left a payable behind
    const [strays]: any = await conn.query(`SELECT COUNT(*) AS n FROM accounts_payable`);
    record('a refused invoice leaves no payable behind', Number(strays[0].n) === 0, `${strays[0].n} payable(s)`);

    // --- the clean match --------------------------------------------------------

    const grniBefore = await balanceOf(conn, grniCode);

    const good = await postVendorInvoice({
      vendorId: 1, invoiceNumber: 'INV-3W-1', invoiceDate: BUSINESS_DATE, amount: '400000',
      lines: [{ grnLineId: 1, quantity: '40', unitPrice: '10000' }],
      userId: 1,
    });
    record(
      'an invoice matching the order and the receipt posts',
      good.match_status === 'matched' && good.matched_lines === 1,
      `status=${good.match_status}, variance=${good.price_variance}`
    );

    const grniAfterGood = await balanceOf(conn, grniCode);
    record(
      'it clears GRNI by exactly what the receipt accrued',
      grniAfterGood === grniBefore - 400000 && Number(good.grni_cleared) === 400000,
      `GRNI ${grniBefore} -> ${grniAfterGood}`
    );

    // --- billing the rest, and then beyond --------------------------------------

    await expectRefused(
      'a second invoice cannot bill past what is left of the receipt',
      'OVER_BILLED_QUANTITY',
      () => postVendorInvoice({
        vendorId: 1, invoiceNumber: 'INV-3W-2', invoiceDate: BUSINESS_DATE, amount: '300000',
        lines: [{ grnLineId: 1, quantity: '30', unitPrice: '10000' }],
        userId: 1,
      })
    );

    // --- price -------------------------------------------------------------------

    // 12,000 against an agreed 10,000 is 20% over: well past tolerance
    await expectRefused(
      'a price far above what was agreed is refused',
      'PRICE_VARIANCE_EXCEEDED',
      () => postVendorInvoice({
        vendorId: 1, invoiceNumber: 'INV-PRICE', invoiceDate: BUSINESS_DATE, amount: '240000',
        lines: [{ grnLineId: 1, quantity: '20', unitPrice: '12000' }],
        userId: 1,
      })
    );

    const approved = await postVendorInvoice({
      vendorId: 1, invoiceNumber: 'INV-PRICE', invoiceDate: BUSINESS_DATE, amount: '240000',
      lines: [{ grnLineId: 1, quantity: '20', unitPrice: '12000' }],
      varianceApproval: { reason: 'agreed surcharge, freight included', authorizedBy: 7 },
      userId: 1,
    });
    record(
      'the same invoice posts once someone accepts the variance',
      approved.match_status === 'variance_approved' && Number(approved.price_variance) === 40000,
      `status=${approved.match_status}, variance=${approved.price_variance}`
    );

    const grniAfterVariance = await balanceOf(conn, grniCode);
    const ppvBalance = await balanceOf(conn, ppvCode);
    const apBalance = await balanceOf(conn, apCode);
    record(
      'GRNI still clears at the accrued cost and the difference lands in variance',
      grniAfterVariance === grniAfterGood - 200000 && ppvBalance === 40000,
      `GRNI ${grniAfterGood} -> ${grniAfterVariance}, PPV ${ppvBalance}`
    );
    record(
      'the payable is what the vendor actually charged',
      apBalance === 640000,
      `AP ${apBalance} against invoices of 400000 + 240000`
    );

    // the whole receipt is now billed: 40 + 20 against 60 received
    const [line]: any = await conn.query(`SELECT quantity_received, quantity_invoiced FROM grn_lines WHERE id = 1`);
    record(
      'the receipt line records how much of it has been billed',
      Number(line[0].quantity_invoiced) === 60,
      `${line[0].quantity_invoiced} of ${line[0].quantity_received} received`
    );

    await expectRefused(
      'a fully billed receipt line refuses any further invoice',
      'OVER_BILLED_QUANTITY',
      () => postVendorInvoice({
        vendorId: 1, invoiceNumber: 'INV-AGAIN', invoiceDate: BUSINESS_DATE, amount: '10000',
        lines: [{ grnLineId: 1, quantity: '1', unitPrice: '10000' }],
        userId: 1,
      })
    );

    // --- the variance account has to be reachable from the ledger -----------------

    const [ppvLines]: any = await conn.query(
      `SELECT COUNT(*) AS n FROM journal_lines jl
         JOIN chart_of_accounts coa ON coa.id = jl.account_id
        WHERE coa.account_code = ?`,
      [ppvCode]
    );
    record(
      'the variance is a journal line, not a hidden adjustment',
      Number(ppvLines[0].n) === 1,
      `${ppvLines[0].n} variance line(s) in the ledger`
    );

    // --- a receipt-less invoice is still possible, and says so --------------------

    const service = await postVendorInvoice({
      vendorId: 1, invoiceNumber: 'INV-SERVICE', invoiceDate: BUSINESS_DATE, amount: '2500000',
      notes: 'annual calibration service, no goods received',
      userId: 1,
    });
    record(
      'an invoice with no receipt lines posts but is marked unmatched',
      service.match_status === 'unmatched' && service.matched_lines === 0,
      `status=${service.match_status}`
    );

    // every posted journal must still balance
    const [unbalanced]: any = await conn.query(
      `SELECT COUNT(*) AS n FROM (
         SELECT jl.journal_entry_id
           FROM journal_lines jl
           JOIN journal_entries je ON je.id = jl.journal_entry_id AND je.status = 'posted'
          GROUP BY jl.journal_entry_id
         HAVING ABS(SUM(COALESCE(jl.debit,0)) - SUM(COALESCE(jl.credit,0))) > 0.005
       ) x`
    );
    record('every journal written here balances', Number(unbalanced[0].n) === 0, `${unbalanced[0].n} unbalanced`);
  } catch (err: any) {
    record('three-way match check completed without unexpected error', false, err.message);
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
  console.error('Three-way match check crashed:', err);
  process.exit(1);
});
