import path from 'path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { bootstrapSchema } from '../lib/schemaBootstrap';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// The sales chain end to end: goods leave at their real lot cost, revenue and a receivable
// are recognised, and the receipt turns that receivable into cash.

const DISPOSABLE_PREFIX = 'erp_salescheck_';
const APPLICATION_DB = process.env.DB_NAME;
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

function assertDisposable(name: string) {
  if (!name.startsWith(DISPOSABLE_PREFIX)) throw new Error(`Refusing to operate on "${name}"`);
  if (name === APPLICATION_DB) throw new Error('Refusing to operate on the application database');
}

async function balanceOfRole(conn: any, role: string): Promise<number> {
  const [rows]: any = await conn.query(
    `SELECT COALESCE(SUM(CASE WHEN coa.normal_balance = 'credit'
                              THEN COALESCE(jl.credit,0) - COALESCE(jl.debit,0)
                              ELSE COALESCE(jl.debit,0) - COALESCE(jl.credit,0) END), 0) AS bal
       FROM journal_lines jl
       JOIN journal_entries je ON je.id = jl.journal_entry_id AND je.status = 'posted'
       JOIN chart_of_accounts coa ON coa.id = jl.account_id
       JOIN account_roles ar ON ar.account_id = coa.id AND ar.role_code = ?`,
    [role]
  );
  return Number(rows[0].bal);
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

    await conn.query(`UPDATE fiscal_periods SET status = 'open' WHERE ? BETWEEN start_date AND end_date`, [BUSINESS_DATE]);
    await conn.query(`INSERT IGNORE INTO fiscal_periods (period_name, start_date, end_date, fiscal_year, period_number, status)
                      VALUES ('2026-03', '2026-03-01', '2026-03-31', 2026, 3, 'open')`);

    // one finished product, in stock as a single lot that cost 6,000 per unit
    await conn.query(`INSERT INTO warehouses (id, code, name) VALUES (1, 'WH-FG', 'Finished Goods')
                      ON DUPLICATE KEY UPDATE name = VALUES(name)`);
    await conn.query(`INSERT INTO products (id, sku, name, unit_of_measure_id) VALUES (1, 'FG-1', 'Cairan A', 1)
                      ON DUPLICATE KEY UPDATE name = VALUES(name)`);
    await conn.query(`INSERT INTO customers (id, code, name) VALUES (1, 'CUST-1', 'PT Pembeli Setia')
                      ON DUPLICATE KEY UPDATE name = VALUES(name)`);
    await conn.query(`INSERT INTO inventory_lots (id, lot_number, product_id, source_type, source_document_id)
                      VALUES (1, 'LOT-FG-1', 1, 'fg_receipt', 1)`);
    await conn.query(`INSERT INTO inventory_stocks (warehouse_id, product_id, quantity, status, lot_id)
                      VALUES (1, 1, 100, 'available', 1)`);
    await conn.query(`INSERT INTO inventory_cost_layers
                      (lot_id, product_id, warehouse_id, source_type, source_document_id, source_line_id,
                       quantity_received, quantity_remaining, quantity_allocated,
                       unit_material_cost, unit_landed_cost, unit_cost, total_cost, created_by)
                      VALUES (1, 1, 1, 'fg_receipt', 1, 1, 100, 100, 0, 6000, 0, 6000, 600000, 1)`);

    await conn.query(`INSERT INTO sales_orders (id, so_number, customer_id, so_date, status)
                      VALUES (1, 'SO-1', 1, ?, 'confirmed')`, [BUSINESS_DATE]);
    await conn.query(`INSERT INTO deliveries (id, do_number, so_id, delivery_date, warehouse_id, status)
                      VALUES (1, 'DO-1', 1, ?, 1, 'draft')`, [BUSINESS_DATE]);
    await conn.query(`INSERT INTO invoices (id, invoice_number, so_id, invoice_date, total_amount, status)
                      VALUES (1, 'INV-1', 1, ?, 0, 'draft')`, [BUSINESS_DATE]);

    process.env.DB_NAME = dbName;
    const { postShipment } = await import('../services/shipment.service');
    const { postCustomerInvoice, postCustomerReceipt } = await import('../services/receivables.service');

    // ship 10 units of the lot that cost 6,000 each
    const ship = await postShipment({
      deliveryId: 1,
      warehouseId: 1,
      shipDate: BUSINESS_DATE,
      lines: [{ soItemId: null, productId: 1, lotId: 1, quantity: '10' }],
      idempotencyKey: 'ship-1',
      userId: 1,
    });
    record('a shipment posts cost of goods sold', Number(ship.total_cost) === 60000, `total cost ${ship.total_cost}`);

    const [stock]: any = await conn.query(`SELECT quantity FROM inventory_stocks WHERE lot_id = 1`);
    record('the exact lot is relieved', Number(stock[0].quantity) === 90, `lot holds ${stock[0].quantity}`);

    const cogs = await balanceOfRole(conn, 'COGS_PRODUCT');
    const fg = await balanceOfRole(conn, 'INVENTORY_FG_AVAILABLE');
    record('cost moves from finished goods to COGS', cogs === 60000 && fg === -60000, `COGS ${cogs}, FG ${fg}`);

    const shipReplay = await postShipment({
      deliveryId: 1, warehouseId: 1, shipDate: BUSINESS_DATE,
      lines: [{ soItemId: null, productId: 1, lotId: 1, quantity: '10' }],
      idempotencyKey: 'ship-1', userId: 1,
    });
    const [stockAfter]: any = await conn.query(`SELECT quantity FROM inventory_stocks WHERE lot_id = 1`);
    record('reposting a shipment ships once', shipReplay.replay === true && Number(stockAfter[0].quantity) === 90, `lot still ${stockAfter[0].quantity}`);

    await conn.query(`INSERT INTO deliveries (id, do_number, so_id, delivery_date, warehouse_id, status)
                      VALUES (2, 'DO-2', 1, ?, 1, 'draft')`, [BUSINESS_DATE]);
    try {
      await postShipment({
        deliveryId: 2, warehouseId: 1, shipDate: BUSINESS_DATE,
        lines: [{ soItemId: null, productId: 1, lotId: 1, quantity: '500' }],
        idempotencyKey: 'ship-over', userId: 1,
      });
      record('shipping more than the lot holds is refused', false, 'it was accepted');
    } catch (err: any) {
      record('shipping more than the lot holds is refused', err.code === 'INSUFFICIENT_STOCK', `${err.code} (${err.httpStatus})`);
    }

    // invoice the customer 100,000 plus 11,000 tax
    const inv = await postCustomerInvoice({
      invoiceId: 1, customerId: 1, netAmount: '100000', taxAmount: '11000',
      invoiceDate: BUSINESS_DATE, userId: 1,
    });
    record('an invoice raises a receivable', Number(inv.amount) === 111000, `receivable ${inv.amount}`);

    const ar = await balanceOfRole(conn, 'AR_CONTROL');
    const revenue = await balanceOfRole(conn, 'SALES_REVENUE_PRODUCT');
    record('revenue and tax are split from the receivable', ar === 111000 && revenue === 100000, `AR ${ar}, revenue ${revenue}`);

    const invReplay = await postCustomerInvoice({
      invoiceId: 1, customerId: 1, netAmount: '100000', taxAmount: '11000', invoiceDate: BUSINESS_DATE, userId: 1,
    });
    record('reposting an invoice recognises it once', invReplay.replay === true && (await balanceOfRole(conn, 'AR_CONTROL')) === 111000, `AR still 111000`);

    // receive half, then the rest
    const part = await postCustomerReceipt({
      invoiceId: 1, amount: '50000', receiptDate: BUSINESS_DATE, idempotencyKey: 'rcpt-1', userId: 1,
    });
    record('a partial receipt leaves the invoice partly settled', part.status === 'partial', `received ${part.received}`);

    const partReplay = await postCustomerReceipt({
      invoiceId: 1, amount: '50000', receiptDate: BUSINESS_DATE, idempotencyKey: 'rcpt-1', userId: 1,
    });
    record('retrying a receipt banks it once', partReplay.replay === true && (await balanceOfRole(conn, 'AR_CONTROL')) === 61000, `AR ${await balanceOfRole(conn, 'AR_CONTROL')}`);

    try {
      await postCustomerReceipt({ invoiceId: 1, amount: '90000', receiptDate: BUSINESS_DATE, idempotencyKey: 'rcpt-over', userId: 1 });
      record('receiving more than the invoice is refused', false, 'it was accepted');
    } catch (err: any) {
      record('receiving more than the invoice is refused', err.code === 'OVER_RECEIPT', `${err.code} (${err.httpStatus})`);
    }

    const rest = await postCustomerReceipt({
      invoiceId: 1, amount: '61000', receiptDate: BUSINESS_DATE, idempotencyKey: 'rcpt-2', userId: 1,
    });
    record('settling the balance closes the receivable', rest.status === 'paid' && (await balanceOfRole(conn, 'AR_CONTROL')) === 0, `status ${rest.status}`);

    // the whole point: margin is measurable from the ledger
    const finalRevenue = await balanceOfRole(conn, 'SALES_REVENUE_PRODUCT');
    const finalCogs = await balanceOfRole(conn, 'COGS_PRODUCT');
    record('gross margin is derivable from the ledger', finalRevenue - finalCogs === 40000, `revenue ${finalRevenue} - COGS ${finalCogs} = ${finalRevenue - finalCogs}`);

    const [unbalanced]: any = await conn.query(
      `SELECT COUNT(*) AS n FROM journal_entries WHERE status = 'posted' AND total_debit <> total_credit`
    );
    record('every posted journal balances', Number(unbalanced[0].n) === 0, `unbalanced ${unbalanced[0].n}`);
  } catch (err: any) {
    record('sales posting check completed without unexpected error', false, err.message);
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
  console.error('Sales posting check crashed:', err);
  process.exit(1);
});
