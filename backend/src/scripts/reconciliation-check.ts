import path from 'path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { bootstrapSchema } from '../lib/schemaBootstrap';
import { reconcileInventory } from '../services/reconciliation.service';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Reconciliation is only worth having if it fails when something is wrong. This starts from a
// balanced position, moves stock through a real posting, and then breaks each record in turn
// to prove the difference is detected rather than absorbed.

const DISPOSABLE_PREFIX = 'erp_reconcheck_';
const APPLICATION_DB = process.env.DB_NAME;
const BASELINE = path.resolve(__dirname, '../../database/schema_mysql.sql');
const MIGRATIONS = path.resolve(__dirname, '../../database/migrations');
const BUSINESS_DATE = '2026-03-14';

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

async function accountIdForRole(conn: any, role: string): Promise<number> {
  const [rows]: any = await conn.query('SELECT account_id FROM account_roles WHERE role_code = ? LIMIT 1', [role]);
  return rows[0]?.account_id;
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

    await conn.query(`INSERT IGNORE INTO fiscal_periods (period_name, start_date, end_date, fiscal_year, period_number, status)
                      VALUES ('2026-03', '2026-03-01', '2026-03-31', 2026, 3, 'open')`);
    await conn.query(`UPDATE fiscal_periods SET status = 'open' WHERE ? BETWEEN start_date AND end_date`, [BUSINESS_DATE]);

    await conn.query(`INSERT IGNORE INTO warehouses (id, code, name) VALUES (1, 'WH-FG', 'Finished Goods')`);
    await conn.query(`INSERT IGNORE INTO products (id, sku, name, unit_of_measure_id) VALUES (1, 'FG-1', 'Cairan A', 1)`);
    await conn.query(`INSERT IGNORE INTO customers (id, code, name) VALUES (1, 'CUST-1', 'PT Pembeli')`);

    // 100 units that cost 6,000 each: on the shelf, valued in a cost layer, and carried by the
    // ledger. Starting balanced is the point; a reconciliation that never balances proves nothing.
    await conn.query(`INSERT IGNORE INTO inventory_lots (id, lot_number, product_id, source_type, source_document_id)
                      VALUES (1, 'LOT-1', 1, 'fg_receipt', 1)`);
    await conn.query(`INSERT INTO inventory_stocks (warehouse_id, product_id, quantity, status, lot_id)
                      VALUES (1, 1, 100, 'available', 1)`);
    await conn.query(`INSERT INTO inventory_cost_layers
                      (lot_id, product_id, warehouse_id, source_type, source_document_id, source_line_id,
                       quantity_received, quantity_remaining, quantity_allocated,
                       unit_material_cost, unit_landed_cost, unit_cost, total_cost, created_by)
                      VALUES (1, 1, 1, 'fg_receipt', 1, 1, 100, 100, 0, 6000, 0, 6000, 600000, 1)`);

    const fgAccount = await accountIdForRole(conn, 'INVENTORY_FG_AVAILABLE');
    const equityAccount = await accountIdForRole(conn, 'RETAINED_EARNINGS');
    await conn.query(
      `INSERT INTO journal_entries (entry_number, entry_date, posting_date, description, journal_type, status, total_debit, total_credit, created_by)
       VALUES ('OPEN-1', ?, ?, 'opening inventory', 'SYSTEM', 'posted', 600000, 600000, 1)`,
      [BUSINESS_DATE, BUSINESS_DATE]
    );
    const [je]: any = await conn.query(`SELECT id FROM journal_entries WHERE entry_number = 'OPEN-1'`);
    await conn.query(`INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES (?, ?, 600000, 0)`, [je[0].id, fgAccount]);
    await conn.query(`INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES (?, ?, 0, 600000)`, [je[0].id, equityAccount]);

    const start = await reconcileInventory(conn, BUSINESS_DATE);
    record(
      'shelf, valuation and ledger agree at the start',
      start.balanced,
      `layers ${start.costLayerValue} vs ledger ${start.ledgerValue}`
    );

    // move stock through a real posting and check the three still agree
    await conn.query(`INSERT IGNORE INTO sales_orders (id, so_number, customer_id, so_date, status) VALUES (1, 'SO-1', 1, ?, 'confirmed')`, [BUSINESS_DATE]);
    await conn.query(`INSERT IGNORE INTO deliveries (id, do_number, so_id, delivery_date, warehouse_id, status) VALUES (1, 'DO-1', 1, ?, 1, 'draft')`, [BUSINESS_DATE]);

    process.env.DB_NAME = dbName;
    const { postShipment } = await import('../services/shipment.service');
    await postShipment({
      deliveryId: 1, warehouseId: 1, shipDate: BUSINESS_DATE,
      lines: [{ soItemId: null, productId: 1, lotId: 1, quantity: '10' }],
      idempotencyKey: 'recon-ship-1', userId: 1,
    });

    const afterShip = await reconcileInventory(conn, BUSINESS_DATE);
    record(
      'they still agree after a shipment',
      afterShip.balanced && Number(afterShip.costLayerValue) === 540000,
      `layers ${afterShip.costLayerValue} vs ledger ${afterShip.ledgerValue}`
    );

    // now break each record in turn

    await conn.query(`UPDATE inventory_cost_layers SET quantity_remaining = quantity_remaining + 5 WHERE id = 1`);
    const valueDrift = await reconcileInventory(conn, BUSINESS_DATE);
    record(
      'valuation drifting from the ledger is detected',
      !valueDrift.balanced && Number(valueDrift.difference) === 30000,
      `difference ${valueDrift.difference}`
    );
    record(
      'the broken layer is named, not just totalled',
      valueDrift.layerBreaches.length === 1 && valueDrift.layerBreaches[0].costLayerId === 1,
      `${valueDrift.layerBreaches.length} layer breach(es)`
    );
    await conn.query(`UPDATE inventory_cost_layers SET quantity_remaining = quantity_remaining - 5 WHERE id = 1`);

    const restored = await reconcileInventory(conn, BUSINESS_DATE);
    record('correcting the layer restores the balance', restored.balanced, `difference ${restored.difference}`);

    // stock that exists on the shelf but nothing values
    await conn.query(`UPDATE inventory_stocks SET quantity = quantity + 7 WHERE lot_id = 1`);
    const shelfDrift = await reconcileInventory(conn, BUSINESS_DATE);
    record(
      'stock on the shelf that nothing values is detected',
      !shelfDrift.balanced && shelfDrift.lotBreaches.length === 1,
      shelfDrift.lotBreaches[0] ? `lot ${shelfDrift.lotBreaches[0].lotId} off by ${shelfDrift.lotBreaches[0].difference}` : 'not detected'
    );
    await conn.query(`UPDATE inventory_stocks SET quantity = quantity - 7 WHERE lot_id = 1`);

    // a journal that moves inventory with no goods behind it
    await conn.query(
      `INSERT INTO journal_entries (entry_number, entry_date, posting_date, description, journal_type, status, total_debit, total_credit, created_by)
       VALUES ('PHANTOM-1', ?, ?, 'inventory with no goods', 'SYSTEM', 'posted', 12345, 12345, 1)`,
      [BUSINESS_DATE, BUSINESS_DATE]
    );
    const [phantom]: any = await conn.query(`SELECT id FROM journal_entries WHERE entry_number = 'PHANTOM-1'`);
    await conn.query(`INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES (?, ?, 12345, 0)`, [phantom[0].id, fgAccount]);
    await conn.query(`INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES (?, ?, 0, 12345)`, [phantom[0].id, equityAccount]);

    const ledgerDrift = await reconcileInventory(conn, BUSINESS_DATE);
    record(
      'a ledger entry with no goods behind it is detected',
      !ledgerDrift.balanced && Number(ledgerDrift.difference) === -12345,
      `difference ${ledgerDrift.difference}`
    );
  } catch (err: any) {
    record('reconciliation check completed without unexpected error', false, err.message);
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
  console.error('Reconciliation check crashed:', err);
  process.exit(1);
});
