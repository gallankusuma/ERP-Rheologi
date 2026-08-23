import fs from 'fs';
import { compileDdl } from './portableDdl';
import {
  computeSha256,
  ensureLedger,
  listPendingMigrations,
  runMigrations,
  splitStatements,
  type MigrationResult,
} from './migrationRunner';

// The baseline schema is version 0 of the same ledger the migration runner owns, so there is
// exactly one authority for "what schema is this database on". Startup and the disposable
// verifier both call bootstrapSchema, which is what makes a local run evidence for production.

const BASELINE_VERSION = 0;
const BASELINE_NAME = 'schema_mysql.sql';

export type BaselineOutcome = 'executed' | 'already_recorded' | 'legacy_adopted';

export interface BootstrapResult {
  baseline: BaselineOutcome;
  migrations: MigrationResult;
}

export class SchemaBootstrapError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'SchemaBootstrapError';
  }
}

// tables and columns the baseline declares, used to decide whether a pre-ledger database
// really is on this baseline rather than merely non-empty
function declaredObjects(sql: string): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const tableRe = /CREATE TABLE (?:IF NOT EXISTS )?`?([A-Za-z0-9_$]+)`?\s*\(([\s\S]*?)\r?\n\)\s*[^;]*;/gi;
  let m;
  while ((m = tableRe.exec(sql))) {
    const cols = new Set<string>();
    for (const line of m[2].split('\n')) {
      const c = line.trim().match(/^`?([A-Za-z0-9_$]+)`?\s+[A-Za-z]/);
      if (c && !/^(PRIMARY|UNIQUE|KEY|INDEX|CONSTRAINT|FOREIGN|FULLTEXT|SPATIAL|CHECK)$/i.test(c[1])) {
        cols.add(c[1].toLowerCase());
      }
    }
    out.set(m[1].toLowerCase(), cols);
  }
  return out;
}

async function baselineDivergence(conn: any, baselineSql: string): Promise<string[]> {
  const declared = declaredObjects(baselineSql);
  const [rows]: any = await conn.query(
    `SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()`
  );
  const live = new Map<string, Set<string>>();
  for (const r of rows) {
    const t = String(r.TABLE_NAME).toLowerCase();
    if (!live.has(t)) live.set(t, new Set());
    live.get(t)!.add(String(r.COLUMN_NAME).toLowerCase());
  }

  const missing: string[] = [];
  for (const [table, cols] of declared) {
    const liveCols = live.get(table);
    if (!liveCols) {
      missing.push(`table ${table}`);
      continue;
    }
    for (const c of cols) {
      if (!liveCols.has(c)) missing.push(`${table}.${c}`);
    }
  }
  return missing;
}

async function countBaseTables(conn: any): Promise<number> {
  const [rows]: any = await conn.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
       AND TABLE_NAME <> '_migration_ledger'`
  );
  return Number(rows[0]?.cnt || 0);
}

async function executeBaseline(conn: any, sql: string, filename: string): Promise<void> {
  const statements = splitStatements(sql);

  for (let i = 0; i < statements.length; i++) {
    const compiled = await compileDdl(statements[i], conn);
    if (compiled.sql === null) continue;
    try {
      await conn.query(compiled.sql);
    } catch (err: any) {
      throw new SchemaBootstrapError(
        'BASELINE_STATEMENT_FAILED',
        `Baseline ${filename} failed at statement ${i + 1}: ${err.message}`
      );
    }
  }
}

/**
 * Apply the baseline schema and every versioned migration under one ledger.
 * Throws on any drift or failure so the caller can refuse to start.
 */
export async function bootstrapSchema(
  conn: any,
  options: { baselinePath: string; migrationDir: string }
): Promise<BootstrapResult> {
  const { baselinePath, migrationDir } = options;

  if (!fs.existsSync(baselinePath)) {
    throw new SchemaBootstrapError(
      'BASELINE_MISSING',
      `Baseline schema not found at ${baselinePath}. Refusing to run migrations against an unverified schema.`
    );
  }

  const baselineSql = fs.readFileSync(baselinePath, 'utf-8');
  const baselineSha = computeSha256(baselineSql);

  await ensureLedger(conn);

  const [ledgerRows]: any = await conn.query('SELECT version, filename, sha256 FROM _migration_ledger WHERE version = ?', [
    BASELINE_VERSION,
  ]);
  const recorded = ledgerRows[0];

  let outcome: BaselineOutcome;

  if (recorded) {
    if (recorded.sha256 !== baselineSha) {
      throw new SchemaBootstrapError(
        'BASELINE_CHECKSUM_MISMATCH',
        `Baseline drift detected: ledger has ${recorded.sha256.substring(0, 12)}..., file is ${baselineSha.substring(0, 12)}.... ` +
          'Baseline is immutable once recorded; express the change as a new versioned migration.'
      );
    }
    outcome = 'already_recorded';
  } else {
    const tableCount = await countBaseTables(conn);

    if (tableCount === 0) {
      await executeBaseline(conn, baselineSql, BASELINE_NAME);
      await conn.query('INSERT INTO _migration_ledger (version, filename, sha256, applied_by) VALUES (?, ?, ?, ?)', [
        BASELINE_VERSION,
        BASELINE_NAME,
        baselineSha,
        'bootstrap',
      ]);
      outcome = 'executed';
    } else {
      // pre-ledger database. Adopting on table count alone would stamp an unrelated schema
      // as "on this baseline", so require that every table and column the baseline declares
      // is actually present before recording it.
      const missing = await baselineDivergence(conn, baselineSql);
      if (missing.length > 0 && process.env.DB_ADOPT_BASELINE !== 'force') {
        throw new SchemaBootstrapError(
          'BASELINE_NOT_EQUIVALENT',
          `Database has ${tableCount} tables but is missing ${missing.length} object(s) the baseline declares ` +
            `(first: ${missing.slice(0, 5).join(', ')}). Reconcile the schema, or set DB_ADOPT_BASELINE=force to adopt deliberately.`
        );
      }

      await conn.query('INSERT INTO _migration_ledger (version, filename, sha256, applied_by) VALUES (?, ?, ?, ?)', [
        BASELINE_VERSION,
        BASELINE_NAME,
        baselineSha,
        missing.length > 0 ? 'legacy_adopted_forced' : 'legacy_adopted',
      ]);
      if (missing.length > 0) {
        console.warn(`Baseline adopted despite ${missing.length} missing object(s); forced by DB_ADOPT_BASELINE.`);
      } else {
        console.warn(`Baseline adopted without execution: ${tableCount} tables already matched the baseline.`);
      }
      outcome = 'legacy_adopted';
    }
  }

  const migrations = await runMigrations(conn, migrationDir);

  if (migrations.errors.length > 0) {
    throw new SchemaBootstrapError(
      'MIGRATION_FAILED',
      `Migration failed (${migrations.errors.length} error(s)). First: ${migrations.errors[0]}`
    );
  }

  return { baseline: outcome, migrations };
}

/**
 * Read-only startup check for deployments where schema changes are an explicit
 * release step. Executes no DDL; throws when the database is not on the expected schema.
 */
export async function verifySchema(
  conn: any,
  options: { baselinePath: string; migrationDir: string }
): Promise<{ applied: number }> {
  const { baselinePath, migrationDir } = options;

  if (!fs.existsSync(baselinePath)) {
    throw new SchemaBootstrapError('BASELINE_MISSING', `Baseline schema not found at ${baselinePath}.`);
  }

  await ensureLedger(conn);

  const baselineSha = computeSha256(fs.readFileSync(baselinePath, 'utf-8'));
  const [rows]: any = await conn.query('SELECT sha256 FROM _migration_ledger WHERE version = 0');

  if (!rows.length) {
    throw new SchemaBootstrapError(
      'SCHEMA_NOT_ADOPTED',
      'This database has no baseline ledger entry. Run "npm run migrate" as a deliberate release step before starting the server.'
    );
  }
  if (rows[0].sha256 !== baselineSha) {
    throw new SchemaBootstrapError(
      'BASELINE_CHECKSUM_MISMATCH',
      'Baseline drift detected between the deployed code and the recorded schema.'
    );
  }

  const report = await listPendingMigrations(conn, migrationDir);

  if (report.errors.length > 0) {
    throw new SchemaBootstrapError('SCHEMA_INVALID', `Schema check failed: ${report.errors[0]}`);
  }
  if (report.pending.length > 0) {
    throw new SchemaBootstrapError(
      'SCHEMA_BEHIND_CODE',
      `${report.pending.length} migration(s) not applied (first: ${report.pending[0]}). ` +
        'Run "npm run migrate" before restarting the server, or set DB_AUTO_MIGRATE=true to apply at startup.'
    );
  }

  return { applied: report.applied.length };
}
