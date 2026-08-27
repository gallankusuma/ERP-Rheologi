import path from 'path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { bootstrapSchema } from '../lib/schemaBootstrap';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Production commands answered a retry with "Material issued successfully" whether or not they
// had done anything, and answered a key reused with a different quantity the same way. A caller
// could not tell the three cases apart, which is the worst possible answer: it reads as done.
//
// These checks issue material for real, then repeat the call, then repeat it with the payload
// changed, and look at the stock and the ledger each time to see what actually happened.

const DISPOSABLE_PREFIX = 'erp_prodidem_';
const APPLICATION_DB = process.env.DB_NAME;
const BASELINE = path.resolve(__dirname, '../../database/schema_mysql.sql');
const MIGRATIONS = path.resolve(__dirname, '../../database/migrations');
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

function assertDisposable(name: string) {
  if (!name.startsWith(DISPOSABLE_PREFIX)) throw new Error(`Refusing to operate on "${name}"`);
  if (name === APPLICATION_DB) throw new Error('Refusing to operate on the application database');
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
    record(label, err.code === expected, `${err.code} (${err.httpStatus ?? err.statusCode})`);
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

    const month = TODAY.slice(0, 7);
    const lastDay = new Date(Number(TODAY.slice(0, 4)), Number(TODAY.slice(5, 7)), 0).getDate();
    await conn.query(
      `INSERT IGNORE INTO fiscal_periods (period_name, start_date, end_date, fiscal_year, period_number, status)
       VALUES (?, ?, ?, ?, ?, 'open')`,
      [month, `${month}-01`, `${month}-${String(lastDay).padStart(2, '0')}`,
       Number(TODAY.slice(0, 4)), Number(TODAY.slice(5, 7))]
    );
    await conn.query(`UPDATE fiscal_periods SET status = 'open' WHERE ? BETWEEN start_date AND end_date`, [TODAY]);

    await conn.query(`INSERT IGNORE INTO warehouses (id, code, name) VALUES (1, 'WH-RM', 'Raw Material')`);
    await conn.query(`INSERT IGNORE INTO products (id, sku, name, unit_of_measure_id) VALUES (1, 'RM-1', 'Resin', 1), (2, 'FG-1', 'Cairan', 1)`);
    await conn.query(
      `INSERT INTO work_orders (id, wo_number, product_id, quantity, status)
       VALUES (1, 'WO-IDEM-1', 2, 100, 'released')`
    );
    await conn.query(
      `INSERT INTO wo_materials (id, wo_id, product_id, quantity_required, quantity_issued)
       VALUES (1, 1, 1, 100, 0)`
    );

    // 60 units on the shelf, valued, so the issue can actually be costed
    await conn.query(
      `INSERT IGNORE INTO inventory_lots (id, lot_number, product_id, source_type, source_document_id)
       VALUES (1, 'LOT-IDEM-1', 1, 'grn', 1)`
    );
    await conn.query(`INSERT INTO inventory_stocks (warehouse_id, product_id, quantity, status, lot_id) VALUES (1, 1, 60, 'available', 1)`);
    await conn.query(
      `INSERT INTO inventory_cost_layers
       (lot_id, product_id, warehouse_id, source_type, source_document_id, source_line_id,
        quantity_received, quantity_remaining, quantity_allocated,
        unit_material_cost, unit_landed_cost, unit_cost, total_cost, created_by)
       VALUES (1, 1, 1, 'grn', 1, 1, 60, 60, 0, 10000, 0, 10000, 600000, 1)`
    );

    process.env.DB_NAME = dbName;
    const { issueWoMaterial } = await import('../services/production.service');

    const KEY = 'issue-key-1';
    const first = await issueWoMaterial({
      woMaterialId: 1, quantity: 10, warehouseId: 1, lotId: 1, userId: 1, idempotencyKey: KEY,
    });
    record(
      'issuing material returns what actually happened, not just a message',
      first.success === true && !!first.issue_id && !!first.journal_id,
      `issue ${first.issue_id}, journal ${first.journal_id}, cost ${first.total_cost}`
    );
    record(
      'the stock and the work order move once',
      Number(await scalar(conn, 'SELECT quantity FROM inventory_stocks WHERE lot_id = 1')) === 50 &&
        Number(await scalar(conn, 'SELECT quantity_issued FROM wo_materials WHERE id = 1')) === 10,
      `stock 50, issued 10`
    );

    // the same request again
    const replay = await issueWoMaterial({
      woMaterialId: 1, quantity: 10, warehouseId: 1, lotId: 1, userId: 1, idempotencyKey: KEY,
    });
    record(
      'a repeat of the same request says it is a replay, and says which issue it was',
      replay.replay === true && replay.issue_id === first.issue_id,
      `replay=${replay.replay}, issue ${replay.issue_id}`
    );
    record(
      'and nothing moves a second time',
      Number(await scalar(conn, 'SELECT quantity FROM inventory_stocks WHERE lot_id = 1')) === 50 &&
        Number(await scalar(conn, 'SELECT COUNT(*) FROM wo_material_issues')) === 1,
      `stock still 50, 1 issue row`
    );

    // the case that used to report success while doing nothing
    await expectRefused(
      'the same key with a different quantity is refused, not answered with success',
      'IDEMPOTENCY_MISMATCH',
      () => issueWoMaterial({
        woMaterialId: 1, quantity: 25, warehouseId: 1, lotId: 1, userId: 1, idempotencyKey: KEY,
      })
    );
    record(
      'and that refusal moves nothing either',
      Number(await scalar(conn, 'SELECT quantity FROM inventory_stocks WHERE lot_id = 1')) === 50,
      `stock still 50`
    );

    // typed refusals, so a route never has to read the message to pick a status
    await expectRefused(
      'issuing without a lot is refused as 422, not a generic failure',
      'LOT_REQUIRED',
      () => issueWoMaterial({
        woMaterialId: 1, quantity: 1, warehouseId: 1, lotId: 0 as any, userId: 1, idempotencyKey: 'k-nolot',
      })
    );
    await expectRefused(
      'issuing more than the work order needs is a 409',
      'OVER_ISSUE',
      () => issueWoMaterial({
        woMaterialId: 1, quantity: 500, warehouseId: 1, lotId: 1, userId: 1, idempotencyKey: 'k-over',
      })
    );
    await expectRefused(
      'issuing more than the lot holds is a 409',
      'INSUFFICIENT_STOCK',
      () => issueWoMaterial({
        woMaterialId: 1, quantity: 80, warehouseId: 1, lotId: 1, userId: 1, idempotencyKey: 'k-short',
      })
    );
    await expectRefused(
      'a lot that is not available stock is a 409',
      'LOT_NOT_AVAILABLE',
      () => issueWoMaterial({
        woMaterialId: 1, quantity: 1, warehouseId: 1, lotId: 999, userId: 1, idempotencyKey: 'k-ghost',
      })
    );

    // a work order that cannot take material
    await conn.query(`UPDATE work_orders SET status = 'completed' WHERE id = 1`);
    await expectRefused(
      'issuing to a completed work order is a 409',
      'INVALID_WO_STATUS',
      () => issueWoMaterial({
        woMaterialId: 1, quantity: 1, warehouseId: 1, lotId: 1, userId: 1, idempotencyKey: 'k-status',
      })
    );
    await conn.query(`UPDATE work_orders SET status = 'released' WHERE id = 1`);

    // the key is scoped to the command, so the same text under FG_RECEIPT is a different claim
    const scopes = await scalar(conn, 'SELECT COUNT(DISTINCT command_scope) FROM idempotency_outcomes');
    record(
      'the outcome is stored against the command, not against the key alone',
      Number(await scalar(conn, `SELECT COUNT(*) FROM idempotency_outcomes WHERE command_scope = 'WO_MATERIAL_ISSUE'`)) === 1,
      `${scopes} scope(s) recorded`
    );

    const [unbalanced]: any = await conn.query(
      `SELECT COUNT(*) AS n FROM (
         SELECT jl.journal_entry_id FROM journal_lines jl
           JOIN journal_entries je ON je.id = jl.journal_entry_id AND je.status = 'posted'
          GROUP BY jl.journal_entry_id
         HAVING ABS(SUM(COALESCE(jl.debit,0)) - SUM(COALESCE(jl.credit,0))) > 0.005) x`
    );
    record('every journal written here balances', Number(unbalanced[0].n) === 0, `${unbalanced[0].n} unbalanced`);
  } catch (err: any) {
    record('production idempotency check completed without unexpected error', false, err.message);
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
  console.error('Production idempotency check crashed:', err);
  process.exit(1);
});
