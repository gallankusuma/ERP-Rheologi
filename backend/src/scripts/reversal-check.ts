import path from 'path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { bootstrapSchema } from '../lib/schemaBootstrap';
import { reconcileInventory } from '../services/reconciliation.service';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Document reversal.
//
// Reversing the journal is the easy half. The half that matters is everything the journal does
// not know about: the receipt line still marked as billed, the invoice number still taken, the
// stock still off the shelf. So each check here reverses a posted document and then proves the
// operation was undone too — most importantly by posting the corrected document afterwards,
// which is the whole point of reversing and the thing that silently fails if a claim is left
// behind.

const DISPOSABLE_PREFIX = 'erp_revcheck_';
const BASELINE = path.resolve(__dirname, '../../database/schema_mysql.sql');
const MIGRATIONS = path.resolve(__dirname, '../../database/migrations');

// the ledger reverses into today's open period, so the test works in the same one
const TODAY = new Date().toISOString().slice(0, 10);

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

async function scalar(conn: any, sql: string, params: any[] = []): Promise<any> {
  const [rows]: any = await conn.query(sql, params);
  return rows[0] ? Object.values(rows[0])[0] : null;
}

async function expectRefused(label: string, expected: string, run: () => Promise<any>) {
  try {
    await run();
    record(label, false, 'it was accepted');
  } catch (err: any) {
    record(label, err.code === expected, `${err.code} (${err.httpStatus || err.statusCode})`);
  }
}

async function openingJournal(conn: any, ref: string, debitRole: string, creditRole: string, amount: number) {
  await conn.query(
    `INSERT INTO journal_entries (entry_number, entry_date, posting_date, description, journal_type, status, total_debit, total_credit, created_by)
     VALUES (?, ?, ?, ?, 'SYSTEM', 'posted', ?, ?, 1)`,
    [ref, TODAY, TODAY, `opening ${ref}`, amount, amount]
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

    // an open period covering today, because a reversal posts into the current one
    const month = TODAY.slice(0, 7);
    const year = Number(TODAY.slice(0, 4));
    const monthNo = Number(TODAY.slice(5, 7));
    const lastDay = new Date(year, monthNo, 0).getDate();
    await conn.query(
      `INSERT IGNORE INTO fiscal_periods (period_name, start_date, end_date, fiscal_year, period_number, status)
       VALUES (?, ?, ?, ?, ?, 'open')`,
      [month, `${month}-01`, `${month}-${String(lastDay).padStart(2, '0')}`, year, monthNo]
    );
    await conn.query(`UPDATE fiscal_periods SET status = 'open' WHERE ? BETWEEN start_date AND end_date`, [TODAY]);

    await conn.query(`INSERT IGNORE INTO vendors (id, code, name) VALUES (1, 'V-001', 'PT Bahan Baku')`);
    await conn.query(`INSERT IGNORE INTO customers (id, code, name) VALUES (1, 'C-001', 'PT Pembeli')`);
    await conn.query(`INSERT IGNORE INTO warehouses (id, code, name) VALUES (1, 'WH-1', 'Gudang Utama')`);
    await conn.query(
      `INSERT IGNORE INTO products (id, sku, name, unit_of_measure_id) VALUES (1, 'RM-1', 'Resin', 1), (2, 'FG-1', 'Cairan A', 1)`
    );

    // a receipt of 60 at 10,000 accrued into GRNI
    await conn.query(
      `INSERT INTO purchase_orders (id, po_number, vendor_id, po_date, status, total_amount)
       VALUES (1, 'PO-V-1', 1, ?, 'APPROVED', 600000)`, [TODAY]
    );
    await conn.query(
      `INSERT INTO purchase_order_items (id, purchase_order_id, product_id, quantity, unit_price, line_total)
       VALUES (1, 1, 1, 60, 10000, 600000)`
    );
    await conn.query(
      `INSERT INTO goods_receipts (id, grn_number, po_id, warehouse_id, received_date, status)
       VALUES (1, 'GRN-V-1', 1, 1, ?, 'APPROVED')`, [TODAY]
    );
    await conn.query(
      `INSERT INTO grn_lines (id, grn_id, po_item_id, product_id, quantity_received, unit_cost)
       VALUES (1, 1, 1, 1, 60, 10000)`
    );
    await conn.query(
      `INSERT IGNORE INTO inventory_lots (id, lot_number, product_id, source_type, source_document_id)
       VALUES (1, 'LOT-RM-1', 1, 'grn', 1)`
    );
    await conn.query(`INSERT INTO inventory_stocks (warehouse_id, product_id, quantity, status, lot_id) VALUES (1, 1, 60, 'available', 1)`);
    await conn.query(
      `INSERT INTO inventory_cost_layers
       (lot_id, product_id, warehouse_id, source_type, source_document_id, source_line_id,
        quantity_received, quantity_remaining, quantity_allocated,
        unit_material_cost, unit_landed_cost, unit_cost, total_cost, created_by)
       VALUES (1, 1, 1, 'grn', 1, 1, 60, 60, 0, 10000, 0, 10000, 600000, 1)`
    );
    await openingJournal(conn, 'RCPT-V-1', 'INVENTORY_RM_AVAILABLE', 'GRNI', 600000);

    // finished goods to ship
    await conn.query(
      `INSERT IGNORE INTO inventory_lots (id, lot_number, product_id, source_type, source_document_id)
       VALUES (2, 'LOT-FG-1', 2, 'fg_receipt', 1)`
    );
    await conn.query(`INSERT INTO inventory_stocks (warehouse_id, product_id, quantity, status, lot_id) VALUES (1, 2, 40, 'available', 2)`);
    await conn.query(
      `INSERT INTO inventory_cost_layers
       (lot_id, product_id, warehouse_id, source_type, source_document_id, source_line_id,
        quantity_received, quantity_remaining, quantity_allocated,
        unit_material_cost, unit_landed_cost, unit_cost, total_cost, created_by)
       VALUES (2, 2, 1, 'fg_receipt', 1, 1, 40, 40, 0, 15000, 0, 15000, 600000, 1)`
    );
    await openingJournal(conn, 'FG-V-1', 'INVENTORY_FG_AVAILABLE', 'RETAINED_EARNINGS', 600000);

    await conn.query(`INSERT INTO sales_orders (id, so_number, customer_id, so_date, status) VALUES (1, 'SO-V-1', 1, ?, 'confirmed')`, [TODAY]);
    for (const [id, doNum] of [[1, 'DO-V-1'], [2, 'DO-V-2']] as Array<[number, string]>) {
      await conn.query(
        `INSERT INTO deliveries (id, do_number, so_id, delivery_date, warehouse_id, status) VALUES (?, ?, 1, ?, 1, 'draft')`,
        [id, doNum, TODAY]
      );
    }
    for (const [id, num] of [[1, 'INV-V-1'], [2, 'INV-V-2']] as Array<[number, string]>) {
      await conn.query(
        `INSERT INTO invoices (id, invoice_number, so_id, invoice_date, total_amount, status) VALUES (?, ?, 1, ?, 5500000, 'OPEN')`,
        [id, num, TODAY]
      );
    }

    const grniCode = await roleAccountCode(conn, 'GRNI');
    const apCode = await roleAccountCode(conn, 'AP_CONTROL');
    const arCode = await roleAccountCode(conn, 'AR_CONTROL');
    const fgCode = await roleAccountCode(conn, 'INVENTORY_FG_AVAILABLE');
    const cogsCode = await roleAccountCode(conn, 'COGS_PRODUCT');

    process.env.DB_NAME = dbName;
    const { postVendorInvoice, postApPayment } = await import('../services/payables.service');
    const { postCustomerInvoice, postCustomerReceipt } = await import('../services/receivables.service');
    const { postShipment } = await import('../services/shipment.service');
    const { postSalesReturn } = await import('../services/returns.service');
    const { reverseVendorInvoice, reverseCustomerInvoice, reverseShipment } = await import('../services/reversal.service');

    // === vendor invoice ========================================================

    const grniStart = await balanceOf(conn, grniCode);

    // posted at the wrong price: 12,000 instead of the agreed 10,000
    const wrong = await postVendorInvoice({
      vendorId: 1, invoiceNumber: 'INV-VEND-77', invoiceDate: TODAY, amount: '600000',
      lines: [{ grnLineId: 1, quantity: '50', unitPrice: '12000' }],
      varianceApproval: { reason: 'keyed from the wrong column', authorizedBy: 1 },
      userId: 1,
    });
    record(
      'a wrong invoice posts and takes the receipt line with it',
      Number(await scalar(conn, 'SELECT quantity_invoiced FROM grn_lines WHERE id = 1')) === 50,
      `AP ${await balanceOf(conn, apCode)}, receipt line billed 50`
    );

    await expectRefused(
      'a reversal without a reason is refused',
      'MISSING_REVERSAL_REASON',
      () => reverseVendorInvoice({ apId: wrong.ap_id, reason: '', idempotencyKey: 'rev-noreason', userId: 1 })
    );

    const reversed = await reverseVendorInvoice({
      apId: wrong.ap_id, reason: 'posted at the wrong unit price', idempotencyKey: 'rev-ap-1', userId: 1,
    });
    record(
      'reversing the invoice mirrors its journal and clears the payable',
      !!reversed.reversal_journal_id && (await balanceOf(conn, apCode)) === 0,
      `reversal journal ${reversed.reversal_journal_id}, AP ${await balanceOf(conn, apCode)}`
    );
    record(
      'GRNI goes back to what the receipt accrued',
      (await balanceOf(conn, grniCode)) === grniStart,
      `GRNI ${grniStart} -> ${await balanceOf(conn, grniCode)}`
    );
    record(
      'the receipt line gets its billed quantity back',
      Number(await scalar(conn, 'SELECT quantity_invoiced FROM grn_lines WHERE id = 1')) === 0,
      `billed ${await scalar(conn, 'SELECT quantity_invoiced FROM grn_lines WHERE id = 1')}`
    );
    record(
      'the original entry is kept, not deleted, and points at its reversal',
      (await scalar(conn, 'SELECT status FROM journal_entries WHERE id = ?', [wrong.journal_id])) === 'posted' &&
        Number(await scalar(conn, 'SELECT reversal_journal_id FROM journal_entries WHERE id = ?', [wrong.journal_id])) ===
          Number(reversed.reversal_journal_id),
      'original still posted, linked to its mirror'
    );

    await expectRefused(
      'reversing the same invoice twice is refused',
      'ALREADY_REVERSED',
      () => reverseVendorInvoice({ apId: wrong.ap_id, reason: 'trying again', idempotencyKey: 'rev-ap-2', userId: 1 })
    );

    // the vendor's invoice number belongs to the vendor: the corrected invoice still carries it
    const corrected = await postVendorInvoice({
      vendorId: 1, invoiceNumber: 'INV-VEND-77', invoiceDate: TODAY, amount: '500000',
      lines: [{ grnLineId: 1, quantity: '50', unitPrice: '10000' }],
      userId: 1,
    });
    record(
      'the corrected invoice can be posted under the same number',
      corrected.ap_id !== wrong.ap_id && corrected.match_status === 'matched',
      `new payable ${corrected.ap_id}, status ${corrected.match_status}`
    );
    record(
      'and it is a new journal, not a replay of the one just reversed',
      corrected.journal_id !== wrong.journal_id && (await balanceOf(conn, apCode)) === 500000,
      `journal ${wrong.journal_id} -> ${corrected.journal_id}, AP ${await balanceOf(conn, apCode)}`
    );

    // once money has moved, the invoice explaining it cannot simply vanish
    await postApPayment({
      apId: corrected.ap_id, amount: '100000', paymentDate: TODAY, idempotencyKey: 'pay-v-1', userId: 1,
    });
    await expectRefused(
      'an invoice that has been paid against cannot be reversed',
      'REVERSAL_BLOCKED',
      () => reverseVendorInvoice({ apId: corrected.ap_id, reason: 'changed my mind', idempotencyKey: 'rev-ap-3', userId: 1 })
    );

    // === customer invoice ======================================================

    const badSale = await postCustomerInvoice({
      invoiceId: 1, customerId: 1, netAmount: '5000000', taxAmount: '500000', invoiceDate: TODAY, userId: 1,
    });
    const arAfterPost = await balanceOf(conn, arCode);

    const salesReversed = await reverseCustomerInvoice({
      invoiceId: 1, reason: 'billed to the wrong customer account', idempotencyKey: 'rev-ar-1', userId: 1,
    });
    record(
      'reversing a customer invoice clears the receivable',
      (await balanceOf(conn, arCode)) === 0 && !!salesReversed.reversal_journal_id,
      `AR ${arAfterPost} -> ${await balanceOf(conn, arCode)}`
    );

    const resale = await postCustomerInvoice({
      invoiceId: 1, customerId: 1, netAmount: '4000000', taxAmount: '400000', invoiceDate: TODAY, userId: 1,
    });
    record(
      'the same invoice can be raised again once corrected',
      resale.ar_id !== badSale.ar_id && (await balanceOf(conn, arCode)) === 4400000,
      `new receivable ${resale.ar_id}, AR ${await balanceOf(conn, arCode)}`
    );

    await postCustomerReceipt({
      invoiceId: 1, amount: '1000000', receiptDate: TODAY, idempotencyKey: 'rcpt-v-1', userId: 1,
    });
    await expectRefused(
      'an invoice money has been received against cannot be reversed',
      'REVERSAL_BLOCKED',
      () => reverseCustomerInvoice({ invoiceId: 1, reason: 'too late now', idempotencyKey: 'rev-ar-2', userId: 1 })
    );

    // === shipment ==============================================================

    const fgStart = await balanceOf(conn, fgCode);
    const stockStart = await stockOfLot(conn, 2);

    // the wrong quantity went out on paper
    await postShipment({
      deliveryId: 1, warehouseId: 1, shipDate: TODAY,
      lines: [{ soItemId: null, productId: 2, lotId: 2, quantity: '20' }],
      idempotencyKey: 'ship-v-1', userId: 1,
    });
    record(
      'a shipment takes stock off the shelf and raises cost of sales',
      (await stockOfLot(conn, 2)) === stockStart - 20 && (await balanceOf(conn, cogsCode)) === 300000,
      `stock ${stockStart} -> ${await stockOfLot(conn, 2)}, COGS ${await balanceOf(conn, cogsCode)}`
    );

    const shipReversed = await reverseShipment({
      deliveryId: 1, reason: 'posted against the wrong delivery order', idempotencyKey: 'rev-ship-1', userId: 1,
    });
    record(
      'reversing the shipment puts the stock back in the lot it came from',
      (await stockOfLot(conn, 2)) === stockStart && Number(shipReversed.cost_restored) === 300000,
      `stock back to ${await stockOfLot(conn, 2)}, cost restored ${shipReversed.cost_restored}`
    );
    record(
      'and takes the cost of sales back out',
      (await balanceOf(conn, cogsCode)) === 0 && (await balanceOf(conn, fgCode)) === fgStart,
      `COGS ${await balanceOf(conn, cogsCode)}, FG ${fgStart} -> ${await balanceOf(conn, fgCode)}`
    );
    record(
      'the cost layer is whole again',
      Number(await scalar(conn, 'SELECT quantity_remaining FROM inventory_cost_layers WHERE lot_id = 2')) === 40 &&
        Number(await scalar(conn, 'SELECT quantity_allocated FROM inventory_cost_layers WHERE lot_id = 2')) === 0,
      `remaining ${await scalar(conn, 'SELECT quantity_remaining FROM inventory_cost_layers WHERE lot_id = 2')}, allocated 0`
    );

    // the delivery is free again, which is the entire point of reversing it
    const reship = await postShipment({
      deliveryId: 1, warehouseId: 1, shipDate: TODAY,
      lines: [{ soItemId: null, productId: 2, lotId: 2, quantity: '8' }],
      idempotencyKey: 'ship-v-1-corrected', userId: 1,
    });
    record(
      'the corrected shipment can be posted against the same delivery',
      !reship.replay && Number(reship.total_cost) === 120000,
      `cost ${reship.total_cost}, stock now ${await stockOfLot(conn, 2)}`
    );

    // a shipment the customer returned against really happened
    await postShipment({
      deliveryId: 2, warehouseId: 1, shipDate: TODAY,
      lines: [{ soItemId: null, productId: 2, lotId: 2, quantity: '6' }],
      idempotencyKey: 'ship-v-2', userId: 1,
    });
    await postCustomerInvoice({
      invoiceId: 2, customerId: 1, netAmount: '2000000', taxAmount: '0', invoiceDate: TODAY, userId: 1,
    });
    const [items2]: any = await conn.query('SELECT id FROM delivery_items WHERE delivery_id = 2');
    await postSalesReturn({
      deliveryId: 2, customerId: 1, warehouseId: 1, invoiceId: 2,
      returnNumber: 'SRET-V-1', returnDate: TODAY,
      lines: [{ deliveryItemId: items2[0].id, quantity: '2', restocked: true, unitPrice: '100000' }],
      idempotencyKey: 'sret-v-1', userId: 1,
    });
    await expectRefused(
      'a shipment the customer returned against cannot be unposted as a mistake',
      'REVERSAL_BLOCKED',
      () => reverseShipment({ deliveryId: 2, reason: 'pretending it never shipped', idempotencyKey: 'rev-ship-2', userId: 1 })
    );

    // === after all of it =======================================================

    const [unbalanced]: any = await conn.query(
      `SELECT COUNT(*) AS n FROM (
         SELECT jl.journal_entry_id
           FROM journal_lines jl
           JOIN journal_entries je ON je.id = jl.journal_entry_id AND je.status = 'posted'
          GROUP BY jl.journal_entry_id
         HAVING ABS(SUM(COALESCE(jl.debit,0)) - SUM(COALESCE(jl.credit,0))) > 0.005
       ) x`
    );
    record('every journal, reversal included, balances', Number(unbalanced[0].n) === 0, `${unbalanced[0].n} unbalanced`);

    const final = await reconcileInventory(conn, TODAY);
    record(
      'shelf, valuation and ledger still agree after every reversal',
      final.balanced,
      `layers ${final.costLayerValue} vs ledger ${final.ledgerValue}, difference ${final.difference}`
    );
  } catch (err: any) {
    record('reversal check completed without unexpected error', false, err.message);
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
  console.error('Reversal check crashed:', err);
  process.exit(1);
});
