import path from 'path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { bootstrapSchema } from '../lib/schemaBootstrap';
import { reconcileInventory } from '../services/reconciliation.service';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Returns on both sides.
//
// A return is where the two records most easily come apart: goods move one way, money moves
// the other, and the two are settled against documents written earlier. So this runs real
// returns through real postings and then checks the three independent records still agree —
// what is on the shelf, what it is worth, and what the ledger says.

const DISPOSABLE_PREFIX = 'erp_retcheck_';
const BASELINE = path.resolve(__dirname, '../../database/schema_mysql.sql');
const MIGRATIONS = path.resolve(__dirname, '../../database/migrations');
const BUSINESS_DATE = '2026-03-18';

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

async function accountIdForRole(conn: any, role: string): Promise<number> {
  const [rows]: any = await conn.query('SELECT account_id FROM account_roles WHERE role_code = ? LIMIT 1', [role]);
  return rows[0]?.account_id;
}

async function stockOfLot(conn: any, lotId: number): Promise<number> {
  const [rows]: any = await conn.query(
    `SELECT COALESCE(SUM(quantity), 0) AS q FROM inventory_stocks WHERE lot_id = ? AND status = 'available'`,
    [lotId]
  );
  return Number(rows[0].q);
}

async function expectRefused(label: string, expected: string, run: () => Promise<any>) {
  try {
    await run();
    record(label, false, 'it was accepted');
  } catch (err: any) {
    record(label, err.code === expected, `${err.code} (${err.httpStatus})`);
  }
}

/** post a balanced opening journal so the ledger starts where the stock does */
async function openingJournal(conn: any, ref: string, debitRole: string, creditRole: string, amount: number) {
  await conn.query(
    `INSERT INTO journal_entries (entry_number, entry_date, posting_date, description, journal_type, status, total_debit, total_credit, created_by)
     VALUES (?, ?, ?, ?, 'SYSTEM', 'posted', ?, ?, 1)`,
    [ref, BUSINESS_DATE, BUSINESS_DATE, `opening ${ref}`, amount, amount]
  );
  const [je]: any = await conn.query('SELECT id FROM journal_entries WHERE entry_number = ?', [ref]);
  await conn.query('INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES (?, ?, ?, 0)', [
    je[0].id, await accountIdForRole(conn, debitRole), amount,
  ]);
  await conn.query('INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES (?, ?, 0, ?)', [
    je[0].id, await accountIdForRole(conn, creditRole), amount,
  ]);
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

    await conn.query(`INSERT IGNORE INTO vendors (id, code, name) VALUES (1, 'V-001', 'PT Bahan Baku'), (2, 'V-002', 'PT Vendor Lain')`);
    await conn.query(`INSERT IGNORE INTO customers (id, code, name) VALUES (1, 'C-001', 'PT Pembeli')`);
    await conn.query(`INSERT IGNORE INTO warehouses (id, code, name) VALUES (1, 'WH-1', 'Gudang Utama')`);
    await conn.query(
      `INSERT IGNORE INTO products (id, sku, name, unit_of_measure_id) VALUES (1, 'RM-1', 'Resin', 1), (2, 'FG-1', 'Cairan A', 1)`
    );

    // --- a receipt of 60 at 10,000 that has not been invoiced yet ---------------
    await conn.query(
      `INSERT INTO purchase_orders (id, po_number, vendor_id, po_date, status, total_amount)
       VALUES (1, 'PO-R-1', 1, ?, 'APPROVED', 600000)`, [BUSINESS_DATE]
    );
    await conn.query(
      `INSERT INTO purchase_order_items (id, purchase_order_id, product_id, quantity, unit_price, line_total)
       VALUES (1, 1, 1, 60, 10000, 600000)`
    );
    await conn.query(
      `INSERT INTO goods_receipts (id, grn_number, po_id, warehouse_id, received_date, status)
       VALUES (1, 'GRN-R-1', 1, 1, ?, 'APPROVED')`, [BUSINESS_DATE]
    );
    await conn.query(
      `INSERT INTO grn_lines (id, grn_id, po_item_id, product_id, quantity_received, unit_cost)
       VALUES (1, 1, 1, 1, 60, 10000)`
    );
    await conn.query(
      `INSERT IGNORE INTO inventory_lots (id, lot_number, product_id, source_type, source_document_id)
       VALUES (1, 'LOT-RM-1', 1, 'grn', 1)`
    );
    await conn.query(
      `INSERT INTO inventory_stocks (warehouse_id, product_id, quantity, status, lot_id) VALUES (1, 1, 60, 'available', 1)`
    );
    await conn.query(
      `INSERT INTO inventory_cost_layers
       (lot_id, product_id, warehouse_id, source_type, source_document_id, source_line_id,
        quantity_received, quantity_remaining, quantity_allocated,
        unit_material_cost, unit_landed_cost, unit_cost, total_cost, created_by)
       VALUES (1, 1, 1, 'grn', 1, 1, 60, 60, 0, 10000, 0, 10000, 600000, 1)`
    );
    // the receipt accrued into GRNI, exactly as a real one would
    await openingJournal(conn, 'RCPT-1', 'INVENTORY_RM_AVAILABLE', 'GRNI', 600000);

    // --- finished goods on the shelf, ready to sell ------------------------------
    await conn.query(
      `INSERT IGNORE INTO inventory_lots (id, lot_number, product_id, source_type, source_document_id)
       VALUES (2, 'LOT-FG-1', 2, 'fg_receipt', 1)`
    );
    await conn.query(
      `INSERT INTO inventory_stocks (warehouse_id, product_id, quantity, status, lot_id) VALUES (1, 2, 40, 'available', 2)`
    );
    await conn.query(
      `INSERT INTO inventory_cost_layers
       (lot_id, product_id, warehouse_id, source_type, source_document_id, source_line_id,
        quantity_received, quantity_remaining, quantity_allocated,
        unit_material_cost, unit_landed_cost, unit_cost, total_cost, created_by)
       VALUES (2, 2, 1, 'fg_receipt', 1, 1, 40, 40, 0, 15000, 0, 15000, 600000, 1)`
    );
    await openingJournal(conn, 'FG-1', 'INVENTORY_FG_AVAILABLE', 'RETAINED_EARNINGS', 600000);

    await conn.query(`INSERT INTO sales_orders (id, so_number, customer_id, so_date, status) VALUES (1, 'SO-R-1', 1, ?, 'confirmed')`, [BUSINESS_DATE]);
    await conn.query(
      `INSERT INTO deliveries (id, do_number, so_id, delivery_date, warehouse_id, status) VALUES (1, 'DO-R-1', 1, ?, 1, 'draft')`, [BUSINESS_DATE]
    );
    await conn.query(
      `INSERT INTO invoices (id, invoice_number, so_id, invoice_date, total_amount, status) VALUES (1, 'INV-R-1', 1, ?, 5500000, 'OPEN')`, [BUSINESS_DATE]
    );

    const grniCode = await roleAccountCode(conn, 'GRNI');
    const apCode = await roleAccountCode(conn, 'AP_CONTROL');
    const arCode = await roleAccountCode(conn, 'AR_CONTROL');
    const rmCode = await roleAccountCode(conn, 'INVENTORY_RM_AVAILABLE');
    const fgCode = await roleAccountCode(conn, 'INVENTORY_FG_AVAILABLE');
    const cogsCode = await roleAccountCode(conn, 'COGS_PRODUCT');
    const revCode = await roleAccountCode(conn, 'SALES_REVENUE_PRODUCT');

    const opening = await reconcileInventory(conn, BUSINESS_DATE);
    record('shelf, valuation and ledger agree before anything moves', opening.balanced, `difference ${opening.difference}`);

    process.env.DB_NAME = dbName;
    const { postPurchaseReturn, postSalesReturn } = await import('../services/returns.service');
    const { postVendorInvoice, postApPayment } = await import('../services/payables.service');
    const { postShipment } = await import('../services/shipment.service');
    const { postCustomerInvoice } = await import('../services/receivables.service');

    // === purchase return, before any invoice ===================================

    const grniBefore = await balanceOf(conn, grniCode);
    const rmBefore = await balanceOf(conn, rmCode);

    const early = await postPurchaseReturn({
      grnId: 1, vendorId: 1, warehouseId: 1,
      returnNumber: 'PRET-1', returnDate: BUSINESS_DATE, reason: 'off-spec on arrival',
      lines: [{ grnLineId: 1, lotId: 1, quantity: '10' }],
      idempotencyKey: 'pret-1', userId: 1,
    });
    record(
      'returning goods that were never invoiced reverses the accrual',
      Number(early.grni_amount) === 100000 && Number(early.debit_note_amount) === 0,
      `GRNI ${early.grni_amount}, debit note ${early.debit_note_amount}`
    );
    // GRNI is a liability, so debiting it takes the accrual back down
    record(
      'the goods leave stock and leave the ledger together',
      (await stockOfLot(conn, 1)) === 50 &&
        (await balanceOf(conn, grniCode)) === grniBefore - 100000 &&
        (await balanceOf(conn, rmCode)) === rmBefore - 100000,
      `stock ${await stockOfLot(conn, 1)}, GRNI ${grniBefore} -> ${await balanceOf(conn, grniCode)}, ` +
        `inventory ${rmBefore} -> ${await balanceOf(conn, rmCode)}`
    );

    const replay = await postPurchaseReturn({
      grnId: 1, vendorId: 1, warehouseId: 1,
      returnNumber: 'PRET-1-again', returnDate: BUSINESS_DATE,
      lines: [{ grnLineId: 1, lotId: 1, quantity: '10' }],
      idempotencyKey: 'pret-1', userId: 1,
    });
    record(
      'a retried return settles once',
      replay.replay === true && replay.purchase_return_id === early.purchase_return_id,
      `return ${replay.purchase_return_id}`
    );

    // === the returned goods must stop being billable ===========================

    await expectRefused(
      'the vendor cannot invoice goods that went back before invoicing',
      'OVER_BILLED_QUANTITY',
      () => postVendorInvoice({
        vendorId: 1, invoiceNumber: 'INV-R-ALL', invoiceDate: BUSINESS_DATE, amount: '600000',
        lines: [{ grnLineId: 1, quantity: '60', unitPrice: '10000' }],
        userId: 1,
      })
    );

    const invoice = await postVendorInvoice({
      vendorId: 1, invoiceNumber: 'INV-R-1', invoiceDate: BUSINESS_DATE, amount: '500000',
      lines: [{ grnLineId: 1, quantity: '50', unitPrice: '10000' }],
      userId: 1,
    });
    record('what is left of the receipt can still be invoiced', invoice.match_status === 'matched', `50 at 10000 = ${invoice.amount}`);

    // === purchase return, after invoicing ======================================

    const apBefore = await balanceOf(conn, apCode);

    const late = await postPurchaseReturn({
      grnId: 1, vendorId: 1, warehouseId: 1,
      returnNumber: 'PRET-2', returnDate: BUSINESS_DATE, reason: 'found damaged in storage',
      lines: [{ grnLineId: 1, lotId: 1, quantity: '5' }],
      idempotencyKey: 'pret-2', userId: 1,
    });
    record(
      'returning goods already invoiced raises a debit note instead',
      Number(late.debit_note_amount) === 50000 && Number(late.grni_amount) === 0,
      `debit note ${late.debit_note_amount}, GRNI ${late.grni_amount}`
    );
    record(
      'the debit note reduces what we owe the vendor',
      (await balanceOf(conn, apCode)) === apBefore - 50000,
      `AP ${apBefore} -> ${await balanceOf(conn, apCode)}`
    );

    const [apRow]: any = await conn.query('SELECT amount, debit_note_amount FROM accounts_payable WHERE id = ?', [invoice.ap_id]);
    record(
      'the payable itself records the debit note against it',
      Number(apRow[0].debit_note_amount) === 50000,
      `invoice ${apRow[0].amount}, debit note ${apRow[0].debit_note_amount}`
    );

    // === the ways a purchase return must be refused ============================

    await expectRefused(
      'returning more than was received is refused',
      'OVER_RETURN_QUANTITY',
      () => postPurchaseReturn({
        grnId: 1, vendorId: 1, warehouseId: 1,
        returnNumber: 'PRET-OVER', returnDate: BUSINESS_DATE,
        lines: [{ grnLineId: 1, lotId: 1, quantity: '50' }],
        idempotencyKey: 'pret-over', userId: 1,
      })
    );

    await expectRefused(
      "a return cannot be booked against the wrong vendor",
      'VENDOR_MISMATCH',
      () => postPurchaseReturn({
        grnId: 1, vendorId: 2, warehouseId: 1,
        returnNumber: 'PRET-VENDOR', returnDate: BUSINESS_DATE,
        lines: [{ grnLineId: 1, lotId: 1, quantity: '1' }],
        idempotencyKey: 'pret-vendor', userId: 1,
      })
    );

    // pay what is still owed, then try to debit-note more of it
    await postApPayment({
      apId: invoice.ap_id, amount: '450000', paymentDate: BUSINESS_DATE,
      idempotencyKey: 'pay-r-1', userId: 1,
    });
    await expectRefused(
      'money already paid cannot be taken back with a debit note',
      'RETURN_ALREADY_PAID',
      () => postPurchaseReturn({
        grnId: 1, vendorId: 1, warehouseId: 1,
        returnNumber: 'PRET-PAID', returnDate: BUSINESS_DATE,
        lines: [{ grnLineId: 1, lotId: 1, quantity: '5' }],
        idempotencyKey: 'pret-paid', userId: 1,
      })
    );

    // === sales return ==========================================================

    await postShipment({
      deliveryId: 1, warehouseId: 1, shipDate: BUSINESS_DATE,
      lines: [{ soItemId: null, productId: 2, lotId: 2, quantity: '20' }],
      idempotencyKey: 'ship-r-1', userId: 1,
    });
    await postCustomerInvoice({
      invoiceId: 1, customerId: 1, netAmount: '5000000', taxAmount: '500000',
      invoiceDate: BUSINESS_DATE, userId: 1,
    });

    const [items]: any = await conn.query('SELECT id FROM delivery_items WHERE delivery_id = 1');
    const deliveryItemId = items[0].id;

    const fgBefore = await balanceOf(conn, fgCode);
    const cogsBefore = await balanceOf(conn, cogsCode);
    const arBefore = await balanceOf(conn, arCode);
    const revBefore = await balanceOf(conn, revCode);
    const stockBefore = await stockOfLot(conn, 2);

    const salesReturn = await postSalesReturn({
      deliveryId: 1, customerId: 1, warehouseId: 1, invoiceId: 1,
      returnNumber: 'SRET-1', returnDate: BUSINESS_DATE, reason: 'customer ordered the wrong grade',
      taxAmount: '125000',
      lines: [{ deliveryItemId, quantity: '5', restocked: true, unitPrice: '250000' }],
      idempotencyKey: 'sret-1', userId: 1,
    });
    record(
      'goods coming back fit to sell reverse the cost of sales',
      Number(salesReturn.cogs_reversed) === 75000,
      `COGS reversed ${salesReturn.cogs_reversed}`
    );
    record(
      'the goods are back on the shelf, in the lot they left from',
      (await stockOfLot(conn, 2)) === stockBefore + 5 &&
        (await balanceOf(conn, fgCode)) === fgBefore + 75000 &&
        (await balanceOf(conn, cogsCode)) === cogsBefore - 75000,
      `stock ${stockBefore} -> ${await stockOfLot(conn, 2)}, FG ${await balanceOf(conn, fgCode)}`
    );
    record(
      'the credit note reverses revenue and tax, and reduces the receivable',
      Number(salesReturn.credit_note_gross) === 1375000 &&
        (await balanceOf(conn, arCode)) === arBefore - 1375000 &&
        (await balanceOf(conn, revCode)) === revBefore - 1250000,
      `credit note ${salesReturn.credit_note_gross}, AR ${await balanceOf(conn, arCode)}`
    );

    // goods that come back broken are not stock, but the sale is still undone
    const fgBeforeScrap = await balanceOf(conn, fgCode);
    const stockBeforeScrap = await stockOfLot(conn, 2);
    const scrapped = await postSalesReturn({
      deliveryId: 1, customerId: 1, warehouseId: 1, invoiceId: 1,
      returnNumber: 'SRET-2', returnDate: BUSINESS_DATE, reason: 'arrived damaged, not resaleable',
      taxAmount: '25000',
      lines: [{ deliveryItemId, quantity: '1', restocked: false, unitPrice: '250000' }],
      idempotencyKey: 'sret-2', userId: 1,
    });
    record(
      'damaged goods are not written back into stock',
      Number(scrapped.cogs_reversed) === 0 &&
        (await stockOfLot(conn, 2)) === stockBeforeScrap &&
        (await balanceOf(conn, fgCode)) === fgBeforeScrap,
      `COGS reversed ${scrapped.cogs_reversed}, stock unchanged at ${stockBeforeScrap}`
    );
    record(
      'but the customer is still credited for them',
      Number(scrapped.credit_note_gross) === 275000,
      `credit note ${scrapped.credit_note_gross}`
    );

    await expectRefused(
      'returning more than was delivered is refused',
      'OVER_RETURN_QUANTITY',
      () => postSalesReturn({
        deliveryId: 1, customerId: 1, warehouseId: 1, invoiceId: 1,
        returnNumber: 'SRET-OVER', returnDate: BUSINESS_DATE,
        lines: [{ deliveryItemId, quantity: '20', unitPrice: '250000' }],
        idempotencyKey: 'sret-over', userId: 1,
      })
    );

    await expectRefused(
      'a credit note larger than the receivable is refused',
      'CREDIT_NOTE_EXCEEDS_RECEIVABLE',
      () => postSalesReturn({
        deliveryId: 1, customerId: 1, warehouseId: 1, invoiceId: 1,
        returnNumber: 'SRET-BIG', returnDate: BUSINESS_DATE,
        lines: [{ deliveryItemId, quantity: '5', unitPrice: '9000000' }],
        idempotencyKey: 'sret-big', userId: 1,
      })
    );

    // === after all of it, the three records must still agree ===================

    const [unbalanced]: any = await conn.query(
      `SELECT COUNT(*) AS n FROM (
         SELECT jl.journal_entry_id
           FROM journal_lines jl
           JOIN journal_entries je ON je.id = jl.journal_entry_id AND je.status = 'posted'
          GROUP BY jl.journal_entry_id
         HAVING ABS(SUM(COALESCE(jl.debit,0)) - SUM(COALESCE(jl.credit,0))) > 0.005
       ) x`
    );
    record('every journal written by a return balances', Number(unbalanced[0].n) === 0, `${unbalanced[0].n} unbalanced`);

    const final = await reconcileInventory(conn, BUSINESS_DATE);
    record(
      'shelf, valuation and ledger still agree after both kinds of return',
      final.balanced,
      `layers ${final.costLayerValue} vs ledger ${final.ledgerValue}, difference ${final.difference}`
    );
  } catch (err: any) {
    record('returns check completed without unexpected error', false, err.message);
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
  console.error('Returns check crashed:', err);
  process.exit(1);
});
