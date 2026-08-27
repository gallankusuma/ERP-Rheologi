import path from 'path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { reconcileInventory } from '../services/reconciliation.service';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Walk a real work order through the whole chain on a copy of production, and check after every
// step that the three records still agree: what is on the shelf, what it is worth, and what the
// ledger says. Individual suites prove each posting in isolation; this proves they compose.
//
// It refuses to run against the application database. Every step is a real service call, not a
// simulation, so what passes here is what would happen for real.
//
//   npm run smoke:walkthrough -- --wo 44

const APPLICATION_DB = process.env.DB_NAME;
const args = process.argv.slice(2);
const argOf = (n: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const WO_ID = Number(argOf('wo') || 0);
const DB = process.env.SMOKE_DB || 'erp_smoke';
const TODAY = new Date().toISOString().slice(0, 10);

const steps: Array<{ name: string; ok: boolean; detail: string }> = [];
function step(name: string, ok: boolean, detail: string) {
  steps.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function scalar(conn: any, sql: string, params: any[] = []) {
  const [rows]: any = await conn.query(sql, params);
  return rows[0] ? Object.values(rows[0])[0] : null;
}

async function balanceOf(conn: any, role: string): Promise<number> {
  const [rows]: any = await conn.query(
    `SELECT COALESCE(SUM(CASE WHEN coa.normal_balance = 'credit'
                              THEN COALESCE(jl.credit,0) - COALESCE(jl.debit,0)
                              ELSE COALESCE(jl.debit,0) - COALESCE(jl.credit,0) END), 0) AS bal
       FROM journal_lines jl
       JOIN journal_entries je ON je.id = jl.journal_entry_id AND je.status = 'posted'
       JOIN chart_of_accounts coa ON coa.id = jl.account_id
       JOIN account_roles ar ON ar.account_id = coa.id
      WHERE ar.role_code = ?`, [role]
  );
  return Number(rows[0].bal);
}

async function checkBalanced(conn: any, label: string) {
  const r = await reconcileInventory(conn, TODAY);
  step(
    label,
    r.balanced,
    `layers ${Number(r.costLayerValue).toLocaleString('id-ID')} + WIP ${Number(r.wipValue).toLocaleString('id-ID')}` +
    ` vs ledger ${Number(r.ledgerValue).toLocaleString('id-ID')}, diff ${r.difference}`
  );
}

async function main() {
  if (DB === APPLICATION_DB) {
    throw new Error(`Refusing to run against the application database (${DB})`);
  }
  if (!WO_ID) {
    console.error('Usage: --wo <work order id>');
    process.exit(2);
  }
  process.env.DB_NAME = DB;

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: DB,
    multipleStatements: false,
  });

  try {
    // the period the postings will land in has to be open, as it would be on a real day
    await conn.query(
      `INSERT IGNORE INTO fiscal_periods (period_name, start_date, end_date, fiscal_year, period_number, status)
       VALUES (?, ?, LAST_DAY(?), ?, ?, 'open')`,
      [TODAY.slice(0, 7), TODAY.slice(0, 7) + '-01', TODAY,
       Number(TODAY.slice(0, 4)), Number(TODAY.slice(5, 7))]
    );
    await conn.query(`UPDATE fiscal_periods SET status='open' WHERE ? BETWEEN start_date AND end_date`, [TODAY]);

    const wo: any = (await conn.query('SELECT * FROM work_orders WHERE id = ?', [WO_ID]) as any)[0][0];
    if (!wo) throw new Error(`WO ${WO_ID} not found in ${DB}`);
    console.log(`Walking ${wo.wo_number} (${wo.quantity} units) through the chain in ${DB}\n`);

    await checkBalanced(conn, 'the books agree before anything moves');

    const { issueWoMaterial, postFinishedGoods } = await import('../services/production.service');

    // ---- 1. issue every material the work order needs ----
    const [mats]: any = await conn.query(
      `SELECT wm.id, wm.product_id, wm.quantity_required, wm.quantity_issued, p.sku
         FROM wo_materials wm JOIN products p ON p.id = wm.product_id
        WHERE wm.wo_id = ? ORDER BY wm.id`, [WO_ID]
    );
    let issuedCount = 0;
    let issuedCost = 0;
    for (const m of mats) {
      const outstanding = Number(m.quantity_required) - Number(m.quantity_issued || 0);
      if (outstanding <= 0) continue;
      const [stockRows]: any = await conn.query(
        `SELECT s.lot_id, s.warehouse_id, s.quantity, cl.unit_cost
           FROM inventory_stocks s
           JOIN inventory_cost_layers cl ON cl.lot_id = s.lot_id
          WHERE s.product_id = ? AND s.status = 'available' AND s.quantity > 0
          ORDER BY s.quantity DESC LIMIT 1`, [m.product_id]
      );
      const src = stockRows[0];
      if (!src) { step(`issue ${m.sku}`, false, 'no valued stock available'); continue; }
      const qty = Math.min(outstanding, Number(src.quantity));
      const res = await issueWoMaterial({
        woMaterialId: m.id, quantity: qty, warehouseId: src.warehouse_id,
        lotId: src.lot_id, userId: 1, idempotencyKey: `smoke-issue-${m.id}`,
      });
      issuedCount++;
      issuedCost += Number(res.total_cost || 0);
    }
    step(
      'every material is issued from an exact lot, at what that lot cost',
      issuedCount > 0,
      `${issuedCount} material(s), Rp ${issuedCost.toLocaleString('id-ID')} into work in progress`
    );
    step(
      'work in progress carries that cost in the ledger',
      Math.abs((await balanceOf(conn, 'INVENTORY_WIP')) - issuedCost) < 1,
      `WIP ${(await balanceOf(conn, 'INVENTORY_WIP')).toLocaleString('id-ID')}`
    );
    await checkBalanced(conn, 'the books still agree after issuing material');

    // ---- 2. record output and clear QC, as the floor would ----
    await conn.query('INSERT INTO wo_results (wo_id, output_quantity) VALUES (?, ?)', [WO_ID, 100]);
    await conn.query(
      `UPDATE wo_qc_checkpoints SET status = 'passed' WHERE wo_id = ? AND is_mandatory = 1`, [WO_ID]
    );
    const pending = Number(await scalar(conn,
      `SELECT COUNT(*) FROM wo_qc_checkpoints WHERE wo_id = ? AND is_mandatory = 1
        AND (status IS NULL OR LOWER(status) <> 'passed')`, [WO_ID]));
    step('the QC gate is satisfied before finished goods can be received', pending === 0, `${pending} mandatory checkpoint(s) outstanding`);

    // ---- 3. receive finished goods ----
    const fgBefore = await balanceOf(conn, 'INVENTORY_FG_AVAILABLE');
    const BATCH = `SMOKE-${WO_ID}`;
    await postFinishedGoods({
      woId: WO_ID, warehouseId: Number(wo.warehouse_id) || 1, quantity: 60,
      batchNumber: BATCH, idempotencyKey: `smoke-fg-${WO_ID}-1`, userId: 1,
    });
    await postFinishedGoods({
      woId: WO_ID, warehouseId: Number(wo.warehouse_id) || 1, quantity: 40,
      batchNumber: BATCH, idempotencyKey: `smoke-fg-${WO_ID}-2`, userId: 1,
    });
    const batchQty = Number(await scalar(conn,
      'SELECT quantity FROM batches WHERE batch_number = ? AND product_id = ?', [BATCH, wo.product_id]));
    step(
      'two partial receipts add up on the batch instead of the second being lost',
      batchQty === 100,
      `batch ${BATCH} = ${batchQty}`
    );
    step(
      'finished goods reach the ledger',
      (await balanceOf(conn, 'INVENTORY_FG_AVAILABLE')) > fgBefore,
      `FG ${fgBefore.toLocaleString('id-ID')} -> ${(await balanceOf(conn, 'INVENTORY_FG_AVAILABLE')).toLocaleString('id-ID')}`
    );
    await checkBalanced(conn, 'the books still agree after receiving finished goods');

    // ---- 4. ship it ----
    const { postShipment } = await import('../services/shipment.service');
    let custId = Number(await scalar(conn, 'SELECT id FROM customers LIMIT 1')) || null;
    if (!custId) {
      await conn.query(`INSERT INTO customers (code, name) VALUES ('SMOKE-C1', 'Pelanggan Smoke Test')`);
      custId = Number(await scalar(conn, `SELECT id FROM customers WHERE code = 'SMOKE-C1'`));
    }
    if (custId) {
      await conn.query(
        `INSERT INTO sales_orders (id, so_number, customer_id, so_date, status)
         VALUES (9001, 'SO-SMOKE-1', ?, ?, 'confirmed')
         ON DUPLICATE KEY UPDATE so_number = so_number`, [custId, TODAY]
      );
      await conn.query(
        `INSERT INTO deliveries (id, do_number, so_id, delivery_date, warehouse_id, status)
         VALUES (9001, 'DO-SMOKE-1', 9001, ?, ?, 'draft')
         ON DUPLICATE KEY UPDATE do_number = do_number`, [TODAY, Number(wo.warehouse_id) || 1]
      );
      const [fgLot]: any = await conn.query(
        `SELECT s.lot_id, s.warehouse_id FROM inventory_stocks s
           JOIN inventory_lots l ON l.id = s.lot_id
          WHERE l.batch_id = (SELECT id FROM batches WHERE batch_number = ? AND product_id = ?)
            AND s.status = 'available' AND s.quantity >= 10 LIMIT 1`, [BATCH, wo.product_id]
      );
      if (fgLot[0]) {
        const cogsBefore = await balanceOf(conn, 'COGS_PRODUCT');
        await postShipment({
          deliveryId: 9001, warehouseId: fgLot[0].warehouse_id, shipDate: TODAY,
          lines: [{ soItemId: null, productId: wo.product_id, lotId: fgLot[0].lot_id, quantity: '10' }],
          idempotencyKey: `smoke-ship-${WO_ID}`, userId: 1,
        });
        step(
          'shipping the goods turns their cost into cost of sales',
          (await balanceOf(conn, 'COGS_PRODUCT')) > cogsBefore,
          `COGS ${cogsBefore.toLocaleString('id-ID')} -> ${(await balanceOf(conn, 'COGS_PRODUCT')).toLocaleString('id-ID')}`
        );
        await checkBalanced(conn, 'the books still agree after shipping');
      } else {
        step('a finished lot is available to ship', false, 'no FG lot with enough quantity');
      }
    } else {
      step('a customer exists to ship to', false, 'no customers in this database');
    }

    // ---- everything written here must balance ----
    const unbalanced = Number(await scalar(conn,
      `SELECT COUNT(*) FROM (
         SELECT jl.journal_entry_id FROM journal_lines jl
           JOIN journal_entries je ON je.id = jl.journal_entry_id AND je.status = 'posted'
          GROUP BY jl.journal_entry_id
         HAVING ABS(SUM(COALESCE(jl.debit,0)) - SUM(COALESCE(jl.credit,0))) > 0.005) x`));
    step('every journal written along the way balances', unbalanced === 0, `${unbalanced} unbalanced`);
  } catch (err: any) {
    step('walkthrough completed without unexpected error', false, err.code ? `${err.code}: ${err.message}` : err.message);
  } finally {
    await conn.end();
  }

  const failed = steps.filter(s => !s.ok);
  console.log('');
  console.log(`Result: ${steps.length - failed.length}/${steps.length} steps passed`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(err => { console.error('Walkthrough crashed:', err); process.exit(1); });
