import path from 'path';
import fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import { bootstrapSchema } from '../lib/schemaBootstrap';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// A fund request is an authorisation, not an economic event. Approving one does not move
// money — it permits the payment, and the payment is what posts.
//
// This ran over HTTP because that is where the defect lived: approving an item settled the
// payable through loose UPDATEs with no journal behind them, so the subledger said paid while
// the ledger still carried the full liability. These checks approve real items and then look
// at the ledger to see whether the money actually landed there.

const DISPOSABLE_PREFIX = 'erp_frcheck_';
const APPLICATION_DB = process.env.DB_NAME;
const BASELINE = path.resolve(__dirname, '../../database/schema_mysql.sql');
const MIGRATIONS = path.resolve(__dirname, '../../database/migrations');
const PORT = 3198;
const BASE = `http://127.0.0.1:${PORT}/api`;
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

async function call(method: string, route: string, opts: { token?: string; body?: any } = {}) {
  const res = await fetch(`${BASE}${route}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let body: any = null;
  try { body = await res.json(); } catch { body = null; }
  return { status: res.status, body };
}

async function waitForServer(proc: ChildProcess, timeoutMs = 90000): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (proc.exitCode !== null) return false;
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return true;
    } catch { /* not listening yet */ }
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
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
      WHERE ar.role_code = ?`,
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
  let server: ChildProcess | null = null;
  const logPath = path.join(process.env.TEMP || '/tmp', `${dbName}.log`);

  try {
    conn = await mysql.createConnection({ ...serverConfig(), database: dbName });
    await bootstrapSchema(conn, { baselinePath: BASELINE, migrationDir: MIGRATIONS });

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

    const hash = await bcrypt.hash('acceptance', 10);
    await conn.query(`INSERT IGNORE INTO roles (id, name) VALUES (1, 'Admin')`);
    await conn.query(
      `INSERT INTO users (id, username, email, password, full_name, role_id, user_level, is_active)
       VALUES (10, 'boss', 'boss@test.local', ?, 'Boss', 1, 1, 1)`,
      [hash]
    );

    await conn.query(`INSERT IGNORE INTO vendors (id, code, name) VALUES (1, 'V-FR', 'PT Pemasok')`);
    await conn.query(
      `INSERT INTO purchase_orders (id, po_number, vendor_id, po_date, status, total_amount)
       VALUES (1, 'PO-FR-1', 1, ?, 'APPROVED', 10000000)`, [TODAY]
    );
    await conn.query(
      `INSERT INTO purchase_order_payment_schedules (id, po_id, schedule_no, label, due_date, amount, status)
       VALUES (1, 1, 1, 'Termin 1', ?, 4000000, 'open')`, [TODAY]
    );
    // a real, posted liability: the vendor is owed 10,000,000
    await conn.query(
      `INSERT INTO accounts_payable (id, po_id, po_schedule_id, vendor_id, invoice_number, invoice_date, amount, paid_amount, status)
       VALUES (1, 1, 1, 1, 'INV-FR-1', ?, 10000000, 0, 'open')`, [TODAY]
    );
    await conn.query(
      `INSERT INTO journal_entries (entry_number, entry_date, posting_date, description, journal_type, status, total_debit, total_credit, created_by)
       VALUES ('AP-FR-1', ?, ?, 'vendor invoice', 'SYSTEM', 'posted', 10000000, 10000000, 10)`, [TODAY, TODAY]
    );
    const [je]: any = await conn.query(`SELECT id FROM journal_entries WHERE entry_number = 'AP-FR-1'`);
    const [apAcc]: any = await conn.query(`SELECT account_id FROM account_roles WHERE role_code = 'AP_CONTROL' LIMIT 1`);
    const [grniAcc]: any = await conn.query(`SELECT account_id FROM account_roles WHERE role_code = 'GRNI' LIMIT 1`);
    await conn.query(`INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES (?, ?, 10000000, 0)`, [je[0].id, grniAcc[0].account_id]);
    await conn.query(`INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES (?, ?, 0, 10000000)`, [je[0].id, apAcc[0].account_id]);
    await conn.query(`UPDATE accounts_payable SET journal_entry_id = ? WHERE id = 1`, [je[0].id]);

    await conn.query(
      `INSERT INTO fund_requests (id, request_number, request_date, po_id, po_schedule_id, vendor_id,
                                  amount, needed_date, purpose, status, requester_id)
       VALUES (1, 'FR-1', ?, 1, 1, 1, 4000000, ?, 'Termin pembayaran', 'submitted', 10)`, [TODAY, TODAY]
    );
    await conn.query(
      `INSERT INTO fund_request_items (id, fund_request_id, po_id, po_schedule_id, vendor_id, description, amount, status)
       VALUES (1, 1, 1, 1, 1, 'Termin 1', 4000000, 'pending'),
              (2, 1, 1, 1, 1, 'Termin 2 kelewat besar', 9000000, 'pending')`
    );

    server = spawn(process.execPath, [require.resolve('tsx/cli'), path.resolve(__dirname, '../index.ts')], {
      env: { ...process.env, DB_NAME: dbName, PORT: String(PORT), NODE_ENV: 'development', DB_AUTO_MIGRATE: 'false' },
      cwd: path.resolve(__dirname, '../..'),
      stdio: ['ignore', fs.openSync(logPath, 'w'), fs.openSync(logPath, 'a')],
    });

    const up = await waitForServer(server);
    record('the server starts', up, up ? `listening on ${PORT}` : `see ${logPath}`);
    if (!up) return;

    const login = await call('POST', '/auth/login', { body: { email: 'boss@test.local', password: 'acceptance' } });
    const boss = login.body?.token;
    record('the approver signs in', login.status === 200 && !!boss, `HTTP ${login.status}`);

    const apBefore = await balanceOf(conn, 'AP_CONTROL');
    const bankBefore = await balanceOf(conn, 'BANK_OPERATING');

    const approve = await call('PUT', '/finance/fund-requests/1/items/1/approve', { token: boss });
    const d = approve.body?.disbursement;
    record(
      'approving a fund request item posts the payment',
      approve.status === 200 && d?.recorded === true && !!d?.journal_id,
      `HTTP ${approve.status}, journal ${d?.journal_id || 'none'}`
    );

    // the whole point: the money has to be in the ledger, not only in the subledger
    const apAfter = await balanceOf(conn, 'AP_CONTROL');
    const bankAfter = await balanceOf(conn, 'BANK_OPERATING');
    record(
      'the ledger shows the liability falling and the cash leaving',
      apAfter === apBefore - 4000000 && bankAfter === bankBefore - 4000000,
      `AP ${apBefore} -> ${apAfter}, bank ${bankBefore} -> ${bankAfter}`
    );

    const [apRow]: any = await conn.query('SELECT paid_amount, status FROM accounts_payable WHERE id = 1');
    record(
      'the subledger agrees with it',
      Number(apRow[0].paid_amount) === 4000000 && apRow[0].status === 'partial',
      `paid ${apRow[0].paid_amount}, status ${apRow[0].status}`
    );

    const [item]: any = await conn.query('SELECT approved_by, ap_id, payment_recorded_at FROM fund_request_items WHERE id = 1');
    record(
      'the item records who approved it',
      Number(item[0].approved_by) === 10,
      `approved_by=${item[0].approved_by ?? 'NULL'}`
    );
    record(
      'and links to the payable it settled',
      Number(item[0].ap_id) === 1 && !!item[0].payment_recorded_at,
      `ap_id=${item[0].ap_id}`
    );

    // approving again must not pay twice
    await conn.query(`UPDATE fund_request_items SET status = 'pending', payment_recorded_at = NULL WHERE id = 1`);
    await call('PUT', '/finance/fund-requests/1/items/1/approve', { token: boss });
    const apRepeat = await balanceOf(conn, 'AP_CONTROL');
    const [payCount]: any = await conn.query('SELECT COUNT(*) AS n FROM ap_payments WHERE ap_id = 1');
    record(
      'approving the same item twice pays once',
      apRepeat === apAfter && Number(payCount[0].n) === 1,
      `AP still ${apRepeat}, ${payCount[0].n} payment row`
    );

    // an item larger than what is still owed must not overpay the vendor
    const over = await call('PUT', '/finance/fund-requests/1/items/2/approve', { token: boss });
    const overD = over.body?.disbursement;
    const apFinal = await balanceOf(conn, 'AP_CONTROL');
    record(
      'an item that would overpay the vendor is refused, and says so',
      overD?.recorded === false && overD?.reason === 'OVER_PAYMENT',
      `recorded=${overD?.recorded}, reason=${overD?.reason}`
    );
    record(
      'and the ledger is untouched by the refusal',
      apFinal === apAfter,
      `AP still ${apFinal}`
    );

    const [unbalanced]: any = await conn.query(
      `SELECT COUNT(*) AS n FROM (
         SELECT jl.journal_entry_id FROM journal_lines jl
           JOIN journal_entries je ON je.id = jl.journal_entry_id AND je.status = 'posted'
          GROUP BY jl.journal_entry_id
         HAVING ABS(SUM(COALESCE(jl.debit,0)) - SUM(COALESCE(jl.credit,0))) > 0.005) x`
    );
    record('every journal balances', Number(unbalanced[0].n) === 0, `${unbalanced[0].n} unbalanced`);
  } catch (err: any) {
    record('fund request check completed without unexpected error', false, err.message);
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
  console.error('Fund request check crashed:', err);
  process.exit(1);
});
