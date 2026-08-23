import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { bootstrapSchema, SchemaBootstrapError } from '../lib/schemaBootstrap';
import { runMigrations, splitStatements } from '../lib/migrationRunner';
import { findUnsupportedGuards } from '../lib/portableDdl';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const BASELINE_PATH = path.resolve(__dirname, '../../database/schema_mysql.sql');
const MIGRATION_DIR = path.resolve(__dirname, '../../database/migrations');
const LEGACY_LEDGER_PATH = path.resolve(__dirname, '../../database/bootstrap_ledger.sql');

const DISPOSABLE_PREFIX = 'erp_migverify_';

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

// refuse to touch anything that is not a database this script created
function assertDisposable(name: string) {
  if (!name.startsWith(DISPOSABLE_PREFIX)) {
    throw new Error(`Refusing to operate on non-disposable database "${name}"`);
  }
  if (name === process.env.DB_NAME) {
    throw new Error('Refusing to operate on the configured application database');
  }
}

// deterministic fingerprint of the resulting schema, ignoring the ledger itself
async function schemaFingerprint(conn: any): Promise<string> {
  const [cols]: any = await conn.query(
    `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME NOT IN ('_migration_ledger','_migration_transitions') AND TABLE_NAME NOT LIKE '%\_backup\_%'
     ORDER BY TABLE_NAME, COLUMN_NAME`
  );
  const [idx]: any = await conn.query(
    `SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME NOT IN ('_migration_ledger','_migration_transitions') AND TABLE_NAME NOT LIKE '%\_backup\_%'
     ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`
  );
  // referential constraints, triggers and views are part of the contract too; a fingerprint
  // over columns and indexes alone can call two structurally different schemas equivalent
  const [fks]: any = await conn.query(
    `SELECT k.TABLE_NAME, k.CONSTRAINT_NAME, k.COLUMN_NAME, k.REFERENCED_TABLE_NAME, k.REFERENCED_COLUMN_NAME,
            r.UPDATE_RULE, r.DELETE_RULE
       FROM information_schema.KEY_COLUMN_USAGE k
       JOIN information_schema.REFERENTIAL_CONSTRAINTS r
         ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
      WHERE k.TABLE_SCHEMA = DATABASE() AND k.REFERENCED_TABLE_NAME IS NOT NULL
      ORDER BY k.TABLE_NAME, k.CONSTRAINT_NAME, k.ORDINAL_POSITION`
  );
  const [triggers]: any = await conn.query(
    `SELECT TRIGGER_NAME, EVENT_MANIPULATION, EVENT_OBJECT_TABLE, ACTION_TIMING, ACTION_STATEMENT
       FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE()
      ORDER BY TRIGGER_NAME`
  );
  const [views]: any = await conn.query(
    `SELECT TABLE_NAME, VIEW_DEFINITION FROM information_schema.VIEWS
      WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME`
  );

  const payload = JSON.stringify({ cols, idx, fks, triggers, views });
  return crypto.createHash('sha256').update(payload, 'utf-8').digest('hex');
}

// structural inventory used to explain a fingerprint mismatch in concrete terms
async function schemaInventory(conn: any): Promise<{ tables: Set<string>; columns: Set<string>; indexes: Set<string>; fks: Set<string> }> {
  const [cols]: any = await conn.query(
    `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME NOT IN ('_migration_ledger','_migration_transitions') AND TABLE_NAME NOT LIKE '%\_backup\_%'`
  );
  const [idx]: any = await conn.query(
    `SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME NOT IN ('_migration_ledger','_migration_transitions') AND TABLE_NAME NOT LIKE '%\_backup\_%'`
  );
  const tables = new Set<string>();
  const columns = new Set<string>();
  for (const c of cols) {
    tables.add(c.TABLE_NAME);
    columns.add(
      `${c.TABLE_NAME}.${c.COLUMN_NAME} ${c.COLUMN_TYPE} null=${c.IS_NULLABLE} default=${c.COLUMN_DEFAULT} extra=${c.EXTRA}`
    );
  }
  const indexes = new Set<string>(
    idx.map((i: any) => `${i.TABLE_NAME}.${i.INDEX_NAME}[${i.SEQ_IN_INDEX}]=${i.COLUMN_NAME} unique=${i.NON_UNIQUE === 0}`)
  );
  const [fk]: any = await conn.query(
    `SELECT k.TABLE_NAME, k.CONSTRAINT_NAME, k.COLUMN_NAME, k.REFERENCED_TABLE_NAME, k.REFERENCED_COLUMN_NAME,
            r.UPDATE_RULE, r.DELETE_RULE
       FROM information_schema.KEY_COLUMN_USAGE k
       JOIN information_schema.REFERENTIAL_CONSTRAINTS r
         ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
      WHERE k.TABLE_SCHEMA = DATABASE() AND k.REFERENCED_TABLE_NAME IS NOT NULL`
  );
  const fks = new Set<string>(
    fk.map(
      (f: any) =>
        `${f.TABLE_NAME}.${f.CONSTRAINT_NAME}: ${f.COLUMN_NAME} -> ${f.REFERENCED_TABLE_NAME}.${f.REFERENCED_COLUMN_NAME} on_update=${f.UPDATE_RULE} on_delete=${f.DELETE_RULE}`
    )
  );

  return { tables, columns, indexes, fks };
}

function reportDiff(label: string, a: Set<string>, b: Set<string>, limit = 12) {
  const onlyA = [...a].filter(x => !b.has(x)).sort();
  const onlyB = [...b].filter(x => !a.has(x)).sort();
  if (onlyA.length) console.log(`      ${label} only after upgrade (${onlyA.length}): ${onlyA.slice(0, limit).join(', ')}`);
  if (onlyB.length) console.log(`      ${label} only in fresh install (${onlyB.length}): ${onlyB.slice(0, limit).join(', ')}`);
}

async function tableCount(conn: any): Promise<number> {
  const [rows]: any = await conn.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME NOT IN ('_migration_ledger','_migration_transitions') AND TABLE_NAME NOT LIKE '%\_backup\_%'`
  );
  return Number(rows[0]?.cnt || 0);
}

// build a throwaway migration directory containing the given files
function makeTempMigrationDir(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migcase-'));
  for (const [name, body] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), body, 'utf-8');
  }
  return dir;
}

// MariaDB accepts guard forms MySQL 8 rejects, so an unhandled one would pass locally and
// only fail in production. This makes that gap fail here instead.
function scenarioGuardCoverage() {
  const offenders: string[] = [];
  for (const f of fs.readdirSync(MIGRATION_DIR).filter(x => x.endsWith('.sql')).sort()) {
    for (const clause of findUnsupportedGuards(fs.readFileSync(path.join(MIGRATION_DIR, f), 'utf-8'))) {
      offenders.push(`${f}: ${clause}`);
    }
  }
  record(
    'every DDL guard in the stream is one the compiler rewrites',
    offenders.length === 0,
    offenders.length === 0 ? 'no engine-specific syntax left unrewritten' : offenders.slice(0, 3).join(' | ')
  );
}

async function scenarioFreshInstall(conn: any): Promise<{ fingerprint: string; applied: number; inventory: any }> {
  const result = await bootstrapSchema(conn, { baselinePath: BASELINE_PATH, migrationDir: MIGRATION_DIR });
  const tables = await tableCount(conn);
  const fingerprint = await schemaFingerprint(conn);

  record(
    'fresh install applies baseline + every migration',
    result.baseline === 'executed' && result.migrations.errors.length === 0,
    `baseline=${result.baseline}, applied=${result.migrations.newlyApplied}, tables=${tables}, noop_stmts=${result.migrations.noopStatements}`
  );

  const [ledger]: any = await conn.query('SELECT COUNT(*) AS cnt FROM _migration_ledger');
  record(
    'every applied migration is recorded in the ledger',
    Number(ledger[0].cnt) === result.migrations.newlyApplied + 1,
    `ledger_rows=${ledger[0].cnt} (expected ${result.migrations.newlyApplied + 1} incl. baseline)`
  );

  return { fingerprint, applied: result.migrations.newlyApplied, inventory: await schemaInventory(conn) };
}

async function scenarioRerun(conn: any, expectedFingerprint: string) {
  const result = await bootstrapSchema(conn, { baselinePath: BASELINE_PATH, migrationDir: MIGRATION_DIR });
  const fingerprint = await schemaFingerprint(conn);

  record(
    'rerun is a no-op and leaves the schema byte-identical',
    result.migrations.newlyApplied === 0 && fingerprint === expectedFingerprint,
    `newly_applied=${result.migrations.newlyApplied}, fingerprint_match=${fingerprint === expectedFingerprint}`
  );
}

async function scenarioBaselineDrift(conn: any) {
  const [before]: any = await conn.query('SELECT sha256 FROM _migration_ledger WHERE version = 0');
  await conn.query("UPDATE _migration_ledger SET sha256 = REPEAT('0', 64) WHERE version = 0");

  let code = 'NONE';
  try {
    await bootstrapSchema(conn, { baselinePath: BASELINE_PATH, migrationDir: MIGRATION_DIR });
  } catch (err) {
    code = err instanceof SchemaBootstrapError ? err.code : 'UNEXPECTED';
  }

  await conn.query('UPDATE _migration_ledger SET sha256 = ? WHERE version = 0', [before[0].sha256]);
  record('baseline drift is rejected', code === 'BASELINE_CHECKSUM_MISMATCH', `code=${code}`);
}

async function scenarioMigrationChecksumMismatch(conn: any) {
  const [row]: any = await conn.query('SELECT filename, sha256 FROM _migration_ledger WHERE version > 0 ORDER BY version LIMIT 1');
  if (!row.length) {
    record('migration checksum mismatch is rejected', false, 'no migration rows in ledger');
    return;
  }
  const { filename, sha256 } = row[0];
  await conn.query("UPDATE _migration_ledger SET sha256 = REPEAT('a', 64) WHERE filename = ?", [filename]);

  const result = await runMigrations(conn, MIGRATION_DIR);
  const rejected = result.errors.some(e => e.startsWith('MIGRATION_CHECKSUM_MISMATCH'));

  await conn.query('UPDATE _migration_ledger SET sha256 = ? WHERE filename = ?', [sha256, filename]);
  record('migration checksum mismatch is rejected', rejected, `on ${filename}, errors=${result.errors.length}`);
}

async function scenarioBadDirectories(conn: any) {
  const [before]: any = await conn.query('SELECT COUNT(*) AS cnt FROM _migration_ledger');

  const dupDir = makeTempMigrationDir({
    '005_alpha.sql': 'SELECT 1;',
    '005_beta.sql': 'SELECT 1;',
  });
  const dupResult = await runMigrations(conn, dupDir, { transitionLedger: false });
  record(
    'duplicate version is rejected before any DDL',
    dupResult.errors.some(e => e.startsWith('DUPLICATE_VERSION')) && dupResult.newlyApplied === 0,
    `errors=${dupResult.errors.length}`
  );

  const unversionedDir = makeTempMigrationDir({ 'add_something.sql': 'SELECT 1;' });
  const unversionedResult = await runMigrations(conn, unversionedDir, { transitionLedger: false });
  record(
    'unversioned file is rejected before any DDL',
    unversionedResult.errors.some(e => e.startsWith('UNVERSIONED_FILE')) && unversionedResult.newlyApplied === 0,
    `errors=${unversionedResult.errors.length}`
  );

  const [after]: any = await conn.query('SELECT COUNT(*) AS cnt FROM _migration_ledger');
  record(
    'rejected directories leave the ledger untouched',
    Number(before[0].cnt) === Number(after[0].cnt),
    `${before[0].cnt} -> ${after[0].cnt}`
  );

  fs.rmSync(dupDir, { recursive: true, force: true });
  fs.rmSync(unversionedDir, { recursive: true, force: true });
}

async function scenarioMidStreamFailure(conn: any) {
  const dir = makeTempMigrationDir({
    '901_ok.sql': 'CREATE TABLE IF NOT EXISTS migverify_ok (id INT PRIMARY KEY);',
    '902_broken.sql': 'CREATE TABLE migverify_broken (id INT PRIMARY KEY);\nTHIS IS NOT SQL;',
    '903_never.sql': 'CREATE TABLE IF NOT EXISTS migverify_never (id INT PRIMARY KEY);',
  });

  const result = await runMigrations(conn, dir, { transitionLedger: false });

  const [recorded]: any = await conn.query(
    "SELECT filename FROM _migration_ledger WHERE filename IN ('901_ok.sql','902_broken.sql','903_never.sql') ORDER BY filename"
  );
  const names = recorded.map((r: any) => r.filename);

  record(
    'failure mid-stream stops the run and records nothing past the failure',
    result.errors.length > 0 && names.includes('901_ok.sql') && !names.includes('902_broken.sql') && !names.includes('903_never.sql'),
    `recorded=[${names.join(', ')}]`
  );

  const [never]: any = await conn.query(
    "SELECT COUNT(*) AS cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'migverify_never'"
  );
  record('migrations after the failure never execute', Number(never[0].cnt) === 0, `migverify_never_exists=${never[0].cnt}`);

  fs.rmSync(dir, { recursive: true, force: true });
}

// load a production schema dump into a throwaway database, then upgrade it through the
// full stream. This is the evidence that a live database survives the release.
async function scenarioUpgradeFromDump(admin: any, dumpPath: string, freshFingerprint: string, freshInventory: any, ledgerPath?: string | null) {
  const dbName = `${DISPOSABLE_PREFIX}shadow_${process.pid}_${Date.now()}`;
  assertDisposable(dbName);

  await admin.query(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  const conn = await mysql.createConnection({ ...serverConfig(), database: dbName });

  try {
    // utf8mb4_0900_ai_ci exists only on MySQL 8. Rewriting it lets a production dump load
    // on MariaDB; structure is unchanged, and the fingerprint compares columns and indexes,
    // not collations. Collation fidelity still needs a MySQL 8 shadow run.
    const dump = fs.readFileSync(dumpPath, 'utf-8').replace(/utf8mb4_0900_ai_ci/g, 'utf8mb4_unicode_ci');
    const statements = splitStatements(dump).filter(s => !/^\s*\/\*!/.test(s));

    // mysqldump emits tables alphabetically, so foreign keys point at tables that do not
    // exist yet; the dump is a snapshot of an already-consistent schema either way
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    let loaded = 0;
    for (const stmt of statements) {
      try {
        await conn.query(stmt);
        loaded++;
      } catch (err: any) {
        record('production dump loads into shadow database', false, `${err.message} on: ${stmt.substring(0, 80)}`);
        return;
      }
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    const before = await tableCount(conn);
    record('production dump loads into shadow database', before > 0, `${loaded} statements, ${before} tables`);

    // load the real ledger the live database carries, so the upgrade is tested against the
    // numbering production actually recorded rather than an empty ledger
    if (ledgerPath) {
      const ledgerSql = fs.readFileSync(ledgerPath, 'utf-8');
      for (const stmt of splitStatements(ledgerSql).filter(x => !/^\s*\/\*!/.test(x))) {
        await conn.query(stmt);
      }
      const [rows]: any = await conn.query('SELECT COUNT(*) AS cnt FROM _migration_ledger');
      record('live ledger rows load into shadow database', Number(rows[0].cnt) > 0, `${rows[0].cnt} rows in the legacy numbering`);
    }

    const result = await bootstrapSchema(conn, { baselinePath: BASELINE_PATH, migrationDir: MIGRATION_DIR });
    const after = await tableCount(conn);

    record(
      'live schema upgrades cleanly through the full stream',
      result.migrations.errors.length === 0,
      `baseline=${result.baseline}, applied=${result.migrations.newlyApplied}, tables ${before} -> ${after}`
    );

    const upgraded = await schemaFingerprint(conn);
    record(
      'upgraded live schema converges with fresh install',
      upgraded === freshFingerprint,
      upgraded === freshFingerprint ? 'fingerprints identical' : 'fingerprints differ — structural diff below'
    );

    if (upgraded !== freshFingerprint) {
      const inv = await schemaInventory(conn);
      reportDiff('tables', inv.tables, freshInventory.tables);
      reportDiff('columns', inv.columns, freshInventory.columns);
      reportDiff('indexes', inv.indexes, freshInventory.indexes);
      reportDiff('foreign keys', inv.fks, freshInventory.fks);
    }

    const rerun = await bootstrapSchema(conn, { baselinePath: BASELINE_PATH, migrationDir: MIGRATION_DIR });
    record('upgraded live schema is stable on rerun', rerun.migrations.newlyApplied === 0, `newly_applied=${rerun.migrations.newlyApplied}`);
  } catch (err: any) {
    record('live schema upgrades cleanly through the full stream', false, err.message);
  } finally {
    await conn.end();
    assertDisposable(dbName);
    await admin.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
  }
}

// simulate a database released under the previous numbering: its ledger names files that no
// longer exist, which without a transition step reads as a version conflict on every row
async function scenarioLedgerTransition(admin: any) {
  const dbName = `${DISPOSABLE_PREFIX}legacy_${process.pid}_${Date.now()}`;
  assertDisposable(dbName);

  await admin.query(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  const conn = await mysql.createConnection({ ...serverConfig(), database: dbName });

  try {
    await bootstrapSchema(conn, { baselinePath: BASELINE_PATH, migrationDir: MIGRATION_DIR });

    // replace the modern ledger with the exact rows a pre-renumbering release wrote
    await conn.query('DELETE FROM _migration_ledger WHERE version > 0');
    const legacy = fs.readFileSync(LEGACY_LEDGER_PATH, 'utf-8').replace(/^﻿/, '');
    let seeded = 0;
    for (const stmt of splitStatements(legacy)) {
      await conn.query(stmt);
      seeded++;
    }

    const result = await runMigrations(conn, MIGRATION_DIR);
    record(
      'legacy ledger is transitioned instead of colliding on version',
      result.errors.length === 0,
      result.errors.length === 0 ? `${seeded} legacy rows re-pointed` : result.errors[0]
    );

    const [audit]: any = await conn.query(
      "SELECT outcome, COUNT(*) AS cnt FROM _migration_transitions GROUP BY outcome ORDER BY outcome"
    );
    const summary = audit.map((a: any) => `${a.outcome}=${a.cnt}`).join(', ');
    record('every transition is recorded for audit', audit.length > 0, summary || 'no rows');

    const [leftover]: any = await conn.query(
      "SELECT COUNT(*) AS cnt FROM _migration_ledger WHERE filename IN ('001_approval_columns.sql','020_consolidate_runtime_ddl.sql','0041_qc_tables.sql')"
    );
    record('no pre-renumbering filenames remain in the ledger', Number(leftover[0].cnt) === 0, `leftover=${leftover[0].cnt}`);

    const again = await runMigrations(conn, MIGRATION_DIR);
    record(
      'transitioned database is stable on rerun',
      again.errors.length === 0 && again.newlyApplied === 0,
      `newly_applied=${again.newlyApplied}, errors=${again.errors.length}`
    );

    // an unknown historical checksum must be refused, not adopted
    await conn.query("UPDATE _migration_ledger SET filename = '999_unknown_release.sql' WHERE version = 21");
    const refused = await runMigrations(conn, MIGRATION_DIR);
    record(
      'unknown historical migration is refused',
      refused.errors.some(e => e.startsWith('SCHEMA_UNSUPPORTED')),
      refused.errors[0] ? refused.errors[0].substring(0, 90) : 'no error raised'
    );
  } catch (err: any) {
    record('legacy ledger is transitioned instead of colliding on version', false, err.message);
  } finally {
    await conn.end();
    assertDisposable(dbName);
    await admin.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
  }
}

function ledgerArg(): string | null {
  const i = process.argv.indexOf('--with-ledger');
  if (i === -1) return null;
  const p = process.argv[i + 1];
  if (!p || !fs.existsSync(p)) throw new Error(`--with-ledger needs a readable ledger dump (got: ${p})`);
  return p;
}

function dumpArg(): string | null {
  const i = process.argv.indexOf('--from-dump');
  if (i === -1) return null;
  const p = process.argv[i + 1];
  if (!p) throw new Error('--from-dump requires a path to a mysqldump --no-data file');
  if (!fs.existsSync(p)) throw new Error(`Dump not found: ${p}`);
  return p;
}

async function main() {
  const keep = process.argv.includes('--keep');
  const dumpPath = dumpArg();
  const dbName = `${DISPOSABLE_PREFIX}${process.pid}_${Date.now()}`;
  assertDisposable(dbName);

  console.log('Migration verifier (disposable database)');
  console.log(`Target: ${dbName}`);
  console.log('');

  const admin = await mysql.createConnection(serverConfig());
  const [ver]: any = await admin.query('SELECT VERSION() AS v');
  console.log(`Engine: ${ver[0].v}`);
  console.log('');

  await admin.query(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);

  let conn: any;
  try {
    conn = await mysql.createConnection({ ...serverConfig(), database: dbName });

    scenarioGuardCoverage();
    const fresh = await scenarioFreshInstall(conn);
    await scenarioRerun(conn, fresh.fingerprint);
    await scenarioBaselineDrift(conn);
    await scenarioMigrationChecksumMismatch(conn);
    await scenarioBadDirectories(conn);
    await scenarioMidStreamFailure(conn);
    await scenarioLedgerTransition(admin);

    if (dumpPath) {
      console.log('');
      console.log(`Shadow upgrade from: ${dumpPath}`);
      await scenarioUpgradeFromDump(admin, dumpPath, fresh.fingerprint, fresh.inventory, ledgerArg());
    }
  } catch (err: any) {
    record('verifier completed without unexpected error', false, err.message);
  } finally {
    if (conn) await conn.end();
    if (!keep) {
      assertDisposable(dbName);
      await admin.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
      console.log('');
      console.log(`Disposable database dropped: ${dbName}`);
    } else {
      console.log('');
      console.log(`Kept for inspection: ${dbName}`);
    }
    await admin.end();
  }

  const failed = checks.filter(c => !c.ok);
  console.log('');
  console.log(`Result: ${checks.length - failed.length}/${checks.length} checks passed`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(err => {
  console.error('Verifier crashed:', err);
  process.exit(1);
});
