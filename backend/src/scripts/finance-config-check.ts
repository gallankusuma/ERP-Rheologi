import path from 'path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { lockPostingPeriod } from '../services/fiscal-period.service';
import { resolveAccountByRole } from '../services/account-role.service';
import { assertClassificationEditable } from '../services/coa.service';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Proves that a posting cannot slip into a period that is closing, and that a role never
// resolves to an account scoped to a context the command is not in.

const DISPOSABLE_PREFIX = 'erp_fincheck_';
const IN_PERIOD = '2026-03-15';

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}
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
  if (name === process.env.DB_NAME) throw new Error('Refusing to operate on the application database');
}

async function setStatus(conn: any, status: string) {
  await conn.query('UPDATE fiscal_periods SET status = ? WHERE id = 1', [status]);
}

async function expectPeriodRejected(
  conn: any,
  label: string,
  type: 'MANUAL' | 'SYSTEM',
  expected: string,
  options?: any
) {
  try {
    await lockPostingPeriod(conn, IN_PERIOD, type, options);
    record(label, false, 'posting was allowed');
  } catch (err: any) {
    record(label, err.code === expected, `${err.code} (${err.statusCode})`);
  }
}

async function expectRoleRejected(conn: any, label: string, scope: any, expected: string) {
  try {
    const r = await resolveAccountByRole(conn, 'INVENTORY', scope, IN_PERIOD);
    record(label, false, `resolved to ${r.accountCode}`);
  } catch (err: any) {
    record(label, err.code === expected, `${err.code} (${err.statusCode})`);
  }
}

async function main() {
  const dbName = `${DISPOSABLE_PREFIX}${process.pid}_${Date.now()}`;
  assertDisposable(dbName);

  const admin = await mysql.createConnection(serverConfig());
  await admin.query(`CREATE DATABASE \`${dbName}\``);
  const conn = await mysql.createConnection({ ...serverConfig(), database: dbName });

  try {
    await conn.query(
      `CREATE TABLE fiscal_periods (
        id INT PRIMARY KEY AUTO_INCREMENT, period_name VARCHAR(50), start_date DATE, end_date DATE,
        fiscal_year INT, period_number INT, status VARCHAR(20) DEFAULT 'open', version INT DEFAULT 1
      ) ENGINE=InnoDB`
    );
    await conn.query(
      `INSERT INTO fiscal_periods (period_name, start_date, end_date, fiscal_year, period_number, status)
       VALUES ('2026-03', '2026-03-01', '2026-03-31', 2026, 3, 'open')`
    );

    await conn.query(
      `CREATE TABLE chart_of_accounts (
        id INT PRIMARY KEY AUTO_INCREMENT, account_code VARCHAR(20), account_name VARCHAR(100),
        is_active TINYINT DEFAULT 1, is_postable TINYINT DEFAULT 1
      ) ENGINE=InnoDB`
    );
    await conn.query(
      `INSERT INTO chart_of_accounts (id, account_code, account_name) VALUES
        (1,'1140','Inventory generic'), (2,'1141','Inventory WH-3'), (3,'1142','Inventory rival')`
    );
    await conn.query(
      `CREATE TABLE account_roles (
        id INT PRIMARY KEY AUTO_INCREMENT, company_id INT DEFAULT 1, role_code VARCHAR(50),
        account_id INT, priority INT DEFAULT 0,
        product_category_id INT NULL, warehouse_id INT NULL, vendor_class VARCHAR(50) NULL,
        customer_class VARCHAR(50) NULL, tax_code VARCHAR(50) NULL, project_id INT NULL,
        cost_center_id INT NULL,
        effective_from DATE DEFAULT '2025-01-01', effective_to DATE NULL
      ) ENGINE=InnoDB`
    );

    // period behaviour
    const open = await lockPostingPeriod(conn, IN_PERIOD, 'MANUAL');
    record('an open period accepts a posting', open.status === 'open', `period ${open.period_name}`);

    await setStatus(conn, 'soft_closed');
    await expectPeriodRejected(conn, 'a soft-closed period refuses a manual journal', 'MANUAL', 'PERIOD_SOFT_CLOSED');
    await expectPeriodRejected(conn, 'a soft-closed period refuses an ordinary system posting', 'SYSTEM', 'PERIOD_SOFT_CLOSED');
    await expectPeriodRejected(
      conn,
      'a correction without a reason is still refused',
      'SYSTEM',
      'PERIOD_SOFT_CLOSED',
      { correction: { reason: '', authorizedBy: 7 } }
    );

    const corrected = await lockPostingPeriod(conn, IN_PERIOD, 'SYSTEM', {
      correction: { reason: 'restated GRN valuation', authorizedBy: 7 },
    });
    record('an authorised correction may post into a soft-closed period', corrected.id === 1, `period ${corrected.period_name}`);

    await setStatus(conn, 'closed');
    await expectPeriodRejected(conn, 'a closed period refuses everything', 'SYSTEM', 'PERIOD_CLOSED', {
      correction: { reason: 'too late', authorizedBy: 7 },
    });
    await setStatus(conn, 'open');

    try {
      await lockPostingPeriod(conn, '2099-01-01', 'SYSTEM');
      record('a date with no period is refused', false, 'it was allowed');
    } catch (err: any) {
      record('a date with no period is refused', err.code === 'PERIOD_NOT_FOUND', `${err.code} (${err.statusCode})`);
    }

    // account role resolution
    await conn.query(`INSERT INTO account_roles (role_code, account_id, priority) VALUES ('INVENTORY', 1, 0)`);
    await conn.query(`INSERT INTO account_roles (role_code, account_id, priority, warehouse_id) VALUES ('INVENTORY', 2, 0, 3)`);

    const generic = await resolveAccountByRole(conn, 'INVENTORY', {}, IN_PERIOD);
    record('an unscoped request resolves to the generic account', generic.accountCode === '1140', `got ${generic.accountCode}`);

    const scoped = await resolveAccountByRole(conn, 'INVENTORY', { warehouseId: 3 }, IN_PERIOD);
    record('a matching warehouse resolves to the scoped account', scoped.accountCode === '1141', `got ${scoped.accountCode}`);

    const other = await resolveAccountByRole(conn, 'INVENTORY', { warehouseId: 9 }, IN_PERIOD);
    record('a different warehouse falls back to generic, not the scoped account', other.accountCode === '1140', `got ${other.accountCode}`);

    // the old resolver would have returned the warehouse-scoped row here
    await conn.query(`DELETE FROM account_roles WHERE account_id = 1`);
    await expectRoleRejected(conn, 'a scoped-only mapping is refused for an unscoped request', {}, 'ACCOUNT_ROLE_NOT_FOUND');

    // two equally specific mappings at the same priority must not be settled by row order
    await conn.query(`INSERT INTO account_roles (role_code, account_id, priority, warehouse_id) VALUES ('INVENTORY', 3, 0, 3)`);
    await expectRoleRejected(conn, 'an equally specific tie is refused', { warehouseId: 3 }, 'ACCOUNT_ROLE_AMBIGUOUS');

    await conn.query(`UPDATE account_roles SET priority = 5 WHERE account_id = 2`);
    const broken = await resolveAccountByRole(conn, 'INVENTORY', { warehouseId: 3 }, IN_PERIOD);
    record('an explicit priority breaks the tie', broken.accountCode === '1141', `got ${broken.accountCode}`);

    // a dimension the mapping constrains must be present in the request
    await conn.query(`UPDATE account_roles SET project_id = 42 WHERE account_id = 2`);

    // the project-scoped mapping drops out, so the warehouse-only mapping answers instead
    const withoutProject = await resolveAccountByRole(conn, 'INVENTORY', { warehouseId: 3 }, IN_PERIOD);
    record(
      'a project-scoped mapping is skipped when the request has no project',
      withoutProject.accountCode === '1142',
      `got ${withoutProject.accountCode}`
    );

    const withProject = await resolveAccountByRole(conn, 'INVENTORY', { warehouseId: 3, projectId: 42 }, IN_PERIOD);
    record('project scope is honoured when supplied', withProject.accountCode === '1141', `got ${withProject.accountCode}`);

    // with no unscoped alternative left, an unmatched dimension is a hard failure rather
    // than a quiet fallback to some other account
    await conn.query(`DELETE FROM account_roles WHERE account_id = 3`);
    await expectRoleRejected(
      conn,
      'a project-scoped mapping alone is refused without a project',
      { warehouseId: 3 },
      'ACCOUNT_ROLE_NOT_FOUND'
    );
    // an account's classification decides where history lands in a report, so it freezes
    // once the account carries posted entries
    await conn.query(
      `CREATE TABLE journal_entries (id INT PRIMARY KEY AUTO_INCREMENT, status VARCHAR(20)) ENGINE=InnoDB`
    );
    await conn.query(
      `CREATE TABLE journal_lines (id INT PRIMARY KEY AUTO_INCREMENT, journal_entry_id INT, account_id INT) ENGINE=InnoDB`
    );

    const unused = { id: 1, account_code: '1140', account_type: 'asset', normal_balance: 'debit', is_header: 0, parent_id: null };
    await assertClassificationEditable(conn, unused, { account_type: 'expense' });
    record('an unused account may be reclassified', true, 'no posted lines, change allowed');

    await conn.query(`INSERT INTO journal_entries (id, status) VALUES (1, 'posted')`);
    await conn.query(`INSERT INTO journal_lines (journal_entry_id, account_id) VALUES (1, 1)`);

    await assertClassificationEditable(conn, unused, { account_type: 'asset', normal_balance: 'debit' });
    record('an unchanged classification is not blocked', true, 'same values pass through');

    for (const [label, change] of [
      ['account type', { account_type: 'expense' }],
      ['normal balance', { normal_balance: 'credit' }],
      ['header flag', { is_header: 1 }],
      ['parent', { parent_id: 9 }],
    ] as Array<[string, any]>) {
      try {
        await assertClassificationEditable(conn, unused, change);
        record(`changing the ${label} of a used account is refused`, false, 'it was allowed');
      } catch (err: any) {
        record(`changing the ${label} of a used account is refused`, err.code === 'COA_IN_USE', `${err.code} (${err.httpStatus})`);
      }
    }
  } catch (err: any) {
    record('finance config check completed without unexpected error', false, err.message);
  } finally {
    await conn.end();
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
  console.error('Finance config check crashed:', err);
  process.exit(1);
});
