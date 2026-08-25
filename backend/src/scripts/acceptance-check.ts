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
