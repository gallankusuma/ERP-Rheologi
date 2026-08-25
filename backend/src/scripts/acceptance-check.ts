import path from 'path';
import fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import { bootstrapSchema } from '../lib/schemaBootstrap';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// End-to-end acceptance against a real running server and a throwaway database.
//
// Every other suite exercises a service directly. This one goes through HTTP, so it proves
// the parts that only exist once routes, auth, permissions and error mapping are wired
// together: that a denial is actually a 403, that a refusal carries its own status rather
// than collapsing into a 500, and that a retry over the wire settles once.

const DISPOSABLE_PREFIX = 'erp_accept_';
const APPLICATION_DB = process.env.DB_NAME;
const BASELINE = path.resolve(__dirname, '../../database/schema_mysql.sql');
const MIGRATIONS = path.resolve(__dirname, '../../database/migrations');
const PORT = 3199;
const BASE = `http://127.0.0.1:${PORT}/api`;

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

async function call(
  method: string,
  route: string,
  opts: { token?: string; body?: any } = {}
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${BASE}${route}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

async function waitForServer(proc: ChildProcess, timeoutMs = 90000): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (proc.exitCode !== null) return false;
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return true;
    } catch {
      // not listening yet
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

async function main() {
  const dbName = `${DISPOSABLE_PREFIX}${process.pid}_${Date.now()}`;
  assertDisposable(dbName);

  const admin = await mysql.createConnection(serverConfig());
  await admin.query(`CREATE DATABASE \`${dbName}\``);

  let conn: any;
  let server: ChildProcess | null = null;
  const logPath = path.join(process.env.TEMP || '/tmp', `${dbName}.log`);

  try {
    conn = await mysql.createConnection({ ...serverConfig(), database: dbName });
    await bootstrapSchema(conn, { baselinePath: BASELINE, migrationDir: MIGRATIONS });

    // two identities: one that bypasses permission checks, one that holds none
    const hash = await bcrypt.hash('acceptance', 10);
    await conn.query(`INSERT IGNORE INTO roles (id, name, description) VALUES (1, 'Admin', 'System Administrator')`);
    await conn.query(`INSERT INTO roles (id, name, description) VALUES (90, 'Restricted', 'No finance access')`);
    await conn.query(
      `INSERT INTO users (id, username, email, password, full_name, role_id, user_level, is_active)
       VALUES (10, 'boss', 'boss@test.local', ?, 'Boss', 1, 1, 1),
              (11, 'clerk', 'clerk@test.local', ?, 'Clerk', 90, 5, 1)`,
      [hash, hash]
    );

    server = spawn(process.execPath, [require.resolve('tsx/cli'), path.resolve(__dirname, '../index.ts')], {
      env: { ...process.env, DB_NAME: dbName, PORT: String(PORT), NODE_ENV: 'development', DB_AUTO_MIGRATE: 'false' },
      cwd: path.resolve(__dirname, '../..'),
      stdio: ['ignore', fs.openSync(logPath, 'w'), fs.openSync(logPath, 'a')],
    });

    const up = await waitForServer(server);
    record('the server starts against a fresh schema', up, up ? `listening on ${PORT}` : `see ${logPath}`);
    if (!up) return;

    // authentication
    const badLogin = await call('POST', '/auth/login', { body: { email: 'clerk@test.local', password: 'definitely-not-it' } });
    record('a wrong password is rejected', badLogin.status === 401, `HTTP ${badLogin.status}`);

    const clerkLogin = await call('POST', '/auth/login', { body: { email: 'clerk@test.local', password: 'acceptance' } });
    const clerk = clerkLogin.body?.token;
    record('a valid login returns a token', clerkLogin.status === 200 && !!clerk, `HTTP ${clerkLogin.status}`);

    const bossLogin = await call('POST', '/auth/login', { body: { email: 'boss@test.local', password: 'acceptance' } });
    const boss = bossLogin.body?.token;
    record('the admin identity logs in', bossLogin.status === 200 && !!boss, `HTTP ${bossLogin.status}`);

    // an unauthenticated call must not reach the ledger
    const anon = await call('GET', '/gl/coa');
    record('the ledger refuses an unauthenticated caller', anon.status === 401, `HTTP ${anon.status}`);

    // a signed-in user with no finance permission must be refused, not served
    const clerkCoa = await call('GET', '/gl/coa', { token: clerk });
    record('a user without finance permission is refused the ledger', clerkCoa.status === 403, `HTTP ${clerkCoa.status}`);

    const bossCoa = await call('GET', '/gl/coa', { token: boss });
    record('the admin identity reads the ledger', bossCoa.status === 200, `HTTP ${bossCoa.status}`);

    // granting the exact permission opens exactly that door
    await conn.query(
      `INSERT INTO role_permissions (role_id, permission_id)
       SELECT 90, id FROM permissions WHERE resource = 'finance.coa' AND action = 'view'`
    );
    const clerkAfterGrant = await call('GET', '/gl/coa', { token: clerk });
    record('granting finance.coa.view lets the same user read', clerkAfterGrant.status === 200, `HTTP ${clerkAfterGrant.status}`);

    const clerkCreate = await call('POST', '/gl/coa', {
      token: clerk,
      body: { account_code: '9999', account_name: 'Nope', account_type: 'asset', normal_balance: 'debit' },
    });
    record('view permission does not imply create', clerkCreate.status === 403, `HTTP ${clerkCreate.status}`);

    // the master identity has no user row, so permission resolution cannot place it
    const masterLogin = await call('POST', '/auth/login', { body: { email: 'master@admin.com', password: 'master' } });
    const master = masterLogin.body?.token;
    const masterCoa = await call('GET', '/gl/coa', { token: master });
    // Current behaviour, asserted so a change to it surfaces here: the master account is
    // hardcoded in the login handler and has no users row, but requirePermission resolves
    // the caller from the database. It can sign in and then fails every gated route.
    record(
      'the hardcoded master identity cannot pass permission checks',
      masterLogin.status === 200 && masterCoa.status === 403,
      `login ${masterLogin.status}, ledger ${masterCoa.status}`
    );

    // domain refusals must carry their own status over the wire, not collapse into a 500
    const opening = await call('POST', '/gl/coa', {
      token: boss,
      body: { account_code: '9101', account_name: 'With opening', account_type: 'asset', normal_balance: 'debit', opening_balance: 5000 },
    });
    record(
      'an opening balance on an account is refused with 422',
      opening.status === 422 && opening.body?.code === 'OPENING_BALANCE_NOT_ACCEPTED',
      `HTTP ${opening.status} ${opening.body?.code || ''}`
    );

    const created = await call('POST', '/gl/coa', {
      token: boss,
      body: { account_code: '9102', account_name: 'Acceptance asset', account_type: 'asset', normal_balance: 'debit' },
    });
    record('an account without an opening balance is created', created.status === 201, `HTTP ${created.status}`);

    const dup = await call('POST', '/gl/coa', {
      token: boss,
      body: { account_code: '9102', account_name: 'Duplicate', account_type: 'asset', normal_balance: 'debit' },
    });
    record('a duplicate account code is refused with 409', dup.status === 409, `HTTP ${dup.status} ${dup.body?.code || ''}`);

    // classification freezes only once the account carries posted entries
    const accountId = created.body?.data?.id;
    const reclassBefore = await call('PUT', `/gl/coa/${accountId}`, { token: boss, body: { account_type: 'expense' } });
    record('an unused account can still be reclassified', reclassBefore.status === 200, `HTTP ${reclassBefore.status}`);

    await conn.query(`INSERT INTO journal_entries (entry_number, entry_date, posting_date, description, journal_type, status, total_debit, total_credit, created_by)
                      VALUES ('ACC-1', CURDATE(), CURDATE(), 'acceptance', 'SYSTEM', 'posted', 100, 100, 10)`);
    const [je]: any = await conn.query(`SELECT id FROM journal_entries WHERE entry_number = 'ACC-1'`);
    await conn.query(`INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES (?, ?, 100, 0)`, [je[0].id, accountId]);

    const reclassAfter = await call('PUT', `/gl/coa/${accountId}`, { token: boss, body: { account_type: 'liability' } });
    record(
      'a used account refuses reclassification with 409',
      reclassAfter.status === 409 && reclassAfter.body?.code === 'COA_IN_USE',
      `HTTP ${reclassAfter.status} ${reclassAfter.body?.code || ''}`
    );

    const rename = await call('PUT', `/gl/coa/${accountId}`, { token: boss, body: { account_name: 'Renamed but same class' } });
    record('a used account can still be renamed', rename.status === 200, `HTTP ${rename.status}`);

    // deactivation, not deletion
    const deact = await call('DELETE', `/gl/coa/${accountId}`, { token: boss });
    const [still]: any = await conn.query(`SELECT is_active FROM chart_of_accounts WHERE id = ?`, [accountId]);
    record(
      'removing an account deactivates it and keeps the row',
      deact.status === 200 && still.length === 1 && Number(still[0].is_active) === 0,
      `HTTP ${deact.status}, row kept with is_active=${still[0]?.is_active}`
    );

    const deactAgain = await call('DELETE', `/gl/coa/${accountId}`, { token: boss });
    record('deactivating twice is idempotent', deactAgain.status === 200, `HTTP ${deactAgain.status}`);

    // The screens that build a return ask the server what is still returnable. Those queries
    // join receipt lines to their lot through the PO line, and a delivery line to the lot it
    // shipped — joins that only fail at runtime, so they are exercised here rather than trusted.
    await conn.query(`INSERT IGNORE INTO vendors (id, code, name) VALUES (1, 'V-ACC', 'PT Vendor')`);
    await conn.query(`INSERT IGNORE INTO warehouses (id, code, name) VALUES (1, 'WH-ACC', 'Gudang')`);
    await conn.query(`INSERT IGNORE INTO products (id, sku, name, unit_of_measure_id) VALUES (1, 'P-ACC', 'Bahan', 1)`);
    await conn.query(
      `INSERT INTO purchase_orders (id, po_number, vendor_id, po_date, status, total_amount)
       VALUES (1, 'PO-ACC-1', 1, CURDATE(), 'APPROVED', 100000)`
    );
    await conn.query(
      `INSERT INTO purchase_order_items (id, purchase_order_id, product_id, quantity, unit_price, line_total)
       VALUES (1, 1, 1, 10, 10000, 100000)`
    );
    await conn.query(
      `INSERT INTO goods_receipts (id, grn_number, po_id, warehouse_id, received_date, status)
       VALUES (1, 'GRN-ACC-1', 1, 1, CURDATE(), 'APPROVED')`
    );
    await conn.query(
      `INSERT INTO grn_lines (id, grn_id, po_item_id, product_id, quantity_received, unit_cost)
       VALUES (1, 1, 1, 1, 10, 10000)`
    );
    await conn.query(
      `INSERT INTO grn_items (id, grn_id, po_item_id, product_id, quantity_received, unit_cost)
       VALUES (1, 1, 1, 1, 10, 10000)`
    );
    await conn.query(
      `INSERT INTO inventory_lots (id, lot_number, product_id, source_type, source_document_id, source_line_id)
       VALUES (1, 'LOT-ACC-1', 1, 'grn_item', 1, 1)`
    );

    const returnable = await call('GET', '/procurement/goods-receipts/1/returnable', { token: boss });
    const rline = returnable.body?.data?.lines?.[0];
    record(
      'a receipt reports what is still returnable, with its lot',
      returnable.status === 200 && Number(rline?.returnable) === 10 && Number(rline?.lot_id) === 1,
      `HTTP ${returnable.status}, returnable ${rline?.returnable}, lot ${rline?.lot_number || 'none'}`
    );

    const returnableDenied = await call('GET', '/procurement/goods-receipts/1/returnable', { token: clerk });
    record(
      'returnable receipt lines are refused without the returns permission',
      returnableDenied.status === 403,
      `HTTP ${returnableDenied.status}`
    );

    await conn.query(`INSERT IGNORE INTO customers (id, code, name) VALUES (1, 'C-ACC', 'PT Pembeli')`);
    await conn.query(`INSERT INTO sales_orders (id, so_number, customer_id, so_date, status) VALUES (1, 'SO-ACC-1', 1, CURDATE(), 'confirmed')`);
    await conn.query(
      `INSERT INTO deliveries (id, do_number, so_id, delivery_date, warehouse_id, status) VALUES (1, 'DO-ACC-1', 1, CURDATE(), 1, 'shipped')`
    );
    await conn.query(
      `INSERT INTO delivery_items (id, delivery_id, product_id, quantity_delivered, lot_id, unit_cost, warehouse_id)
       VALUES (1, 1, 1, 4, 1, 10000, 1)`
    );

    // These two returned 500 on every call for months, because they queried a table named
    // sales_invoices that has never existed. Nothing failed loudly enough to be noticed, so
    // they are asserted here: a screen nobody tests is a screen that quietly stops working.
    const paymentsList = await call('GET', '/sales/payments', { token: boss });
    record(
      'the payments list loads instead of failing',
      paymentsList.status === 200 && Array.isArray(paymentsList.body),
      `HTTP ${paymentsList.status}`
    );

    const paymentsSummary = await call('GET', '/sales/payments/summary', { token: boss });
    record(
      'the payments summary loads and reports what is still owed',
      paymentsSummary.status === 200 && typeof paymentsSummary.body?.pending_amount === 'number',
      `HTTP ${paymentsSummary.status}, outstanding ${paymentsSummary.body?.pending_amount}`
    );

    // recording a receipt used to insert the payment and then fail, leaving money recorded
    // with no journal behind it; now it is refused outright when there is nothing to receive against
    const orphanPayment = await call('POST', '/sales/payments', {
      token: boss,
      body: { invoice_id: 999999, amount: 1000, payment_date: '2026-03-01' },
    });
    record(
      'a receipt against an invoice with no receivable is refused, not half-recorded',
      orphanPayment.status === 404 && orphanPayment.body?.code === 'AR_NOT_FOUND',
      `HTTP ${orphanPayment.status} ${orphanPayment.body?.code || ''}`
    );

    const [strayPayments]: any = await conn.query(`SELECT COUNT(*) AS n FROM sales_payments`);
    record(
      'and it leaves no payment row behind',
      Number(strayPayments[0].n) === 0,
      `${strayPayments[0].n} payment row(s)`
    );

    const dReturnable = await call('GET', '/sales/deliveries/1/returnable', { token: boss });
    const dline = dReturnable.body?.data?.lines?.[0];
    record(
      'a delivery reports what is still returnable, with its lot and cost',
      dReturnable.status === 200 && Number(dline?.returnable) === 4 && Number(dline?.unit_cost) === 10000,
      `HTTP ${dReturnable.status}, returnable ${dline?.returnable}, cost ${dline?.unit_cost}`
    );
  } catch (err: any) {
    record('acceptance run completed without unexpected error', false, err.message);
  } finally {
    if (server && server.exitCode === null) server.kill();
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
  console.error('Acceptance check crashed:', err);
  process.exit(1);
});
