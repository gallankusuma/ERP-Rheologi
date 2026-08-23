import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { compileDdl } from './portableDdl';
import { applyLedgerTransition } from './ledgerTransition';

const LOCK_NAME = 'erp_migration_runner';
const LOCK_TIMEOUT = 30;

interface LedgerRow {
  version: number;
  filename: string;
  sha256: string;
  applied_at: string;
}

interface ParsedFile {
  filename: string;
  version: number;
  name: string;
}

// parse a migration filename — requires numeric prefix
function parseVersion(filename: string): ParsedFile | null {
  const match = filename.match(/^(\d+)[_-](.+)\.sql$/);
  if (!match) return null;
  return { filename, version: parseInt(match[1], 10), name: match[2] };
}

export function computeSha256(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
}

// delimiter-aware SQL splitter: handles DELIMITER // ... DELIMITER ;
export function splitStatements(sql: string): string[] {
  const results: string[] = [];
  let currentDelimiter = ';';
  let buffer = '';
  const lines = sql.split('\n');

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    // skip full-line comments
    if (trimmed.startsWith('--')) continue;

    // handle DELIMITER directive
    const delimMatch = trimmed.match(/^DELIMITER\s+(.+)$/i);
    if (delimMatch) {
      const newDelim = delimMatch[1].trim();
      if (buffer.trim().length > 0) {
        results.push(buffer.trim());
        buffer = '';
      }
      currentDelimiter = newDelim;
      continue;
    }

    buffer += rawLine + '\n';

    // check if the buffer ends with the current delimiter
    const bufTrimmed = buffer.trimEnd();
    if (bufTrimmed.endsWith(currentDelimiter)) {
      // remove the delimiter from the end
      const stmt = bufTrimmed.substring(0, bufTrimmed.length - currentDelimiter.length).trim();
      if (stmt.length > 0) {
        results.push(stmt);
      }
      buffer = '';
    }
  }

  // any remaining content
  const remaining = buffer.trim();
  if (remaining.length > 0) {
    results.push(remaining);
  }

  return results;
}

export async function ensureLedger(conn: any) {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS _migration_ledger (
      id INT PRIMARY KEY AUTO_INCREMENT,
      version INT NOT NULL,
      filename VARCHAR(255) NOT NULL,
      sha256 VARCHAR(64) NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      applied_by VARCHAR(100) NULL,
      UNIQUE KEY uq_ledger_version (version),
      UNIQUE KEY uq_ledger_filename (filename)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  // add unique version constraint to existing ledgers that only had filename unique
  try {
    await conn.execute('ALTER TABLE _migration_ledger ADD UNIQUE KEY uq_ledger_version (version)');
  } catch (e: any) {
    // ignore if already exists
    if (!e.message.includes('Duplicate key name')) throw e;
  }
}

async function getAppliedMigrations(conn: any): Promise<Map<string, LedgerRow>> {
  const [rows] = await conn.execute('SELECT version, filename, sha256, applied_at FROM _migration_ledger ORDER BY version, filename');
  const map = new Map<string, LedgerRow>();
  for (const row of rows as LedgerRow[]) {
    map.set(row.filename, row);
  }
  return map;
}

async function acquireLock(conn: any): Promise<boolean> {
  const [rows] = await conn.execute('SELECT GET_LOCK(?, ?) as locked', [LOCK_NAME, LOCK_TIMEOUT]);
  return (rows as any[])[0]?.locked === 1;
}

async function releaseLock(conn: any) {
  await conn.execute('SELECT RELEASE_LOCK(?)', [LOCK_NAME]);
}

export interface MigrationResult {
  totalFiles: number;
  alreadyApplied: number;
  newlyApplied: number;
  noopStatements: number;
  errors: string[];
}

// validate migration files before executing any DDL
function validateFiles(files: string[]): { parsed: ParsedFile[]; errors: string[] } {
  const errors: string[] = [];
  const parsed: ParsedFile[] = [];
  const versionMap = new Map<number, string[]>();

  for (const f of files) {
    const p = parseVersion(f);
    if (!p) {
      errors.push(`UNVERSIONED_FILE: "${f}" has no numeric version prefix. All migration files must start with a number (e.g., 001_name.sql).`);
      continue;
    }
    parsed.push(p);

    const existing = versionMap.get(p.version) || [];
    existing.push(f);
    versionMap.set(p.version, existing);
  }

  // check for duplicate versions
  for (const [version, filenames] of versionMap) {
    if (filenames.length > 1) {
      errors.push(`DUPLICATE_VERSION: version ${version} appears in ${filenames.length} files: ${filenames.join(', ')}`);
    }
  }

  // sort by version, then by filename for stability
  parsed.sort((a, b) => {
    if (a.version !== b.version) return a.version - b.version;
    return a.filename.localeCompare(b.filename);
  });

  return { parsed, errors };
}

export interface PendingReport {
  applied: string[];
  pending: string[];
  errors: string[];
}

/**
 * Read-only view of which migrations are still outstanding.
 * Performs no DDL, so it is safe to call on a live database at startup.
 */
export async function listPendingMigrations(conn: any, migrationDir: string): Promise<PendingReport> {
  const report: PendingReport = { applied: [], pending: [], errors: [] };

  if (!fs.existsSync(migrationDir)) {
    report.errors.push(`Migration directory not found: ${migrationDir}`);
    return report;
  }

  const allFiles = fs.readdirSync(migrationDir).filter(f => f.endsWith('.sql'));
  const { parsed, errors } = validateFiles(allFiles);
  if (errors.length > 0) {
    report.errors.push(...errors);
    return report;
  }

  await ensureLedger(conn);
  const applied = await getAppliedMigrations(conn);

  for (const pf of parsed) {
    const existing = applied.get(pf.filename);
    if (!existing) {
      report.pending.push(pf.filename);
      continue;
    }
    const sha256 = computeSha256(fs.readFileSync(path.join(migrationDir, pf.filename), 'utf-8'));
    if (existing.sha256 !== sha256) {
      report.errors.push(`MIGRATION_CHECKSUM_MISMATCH: ${pf.filename}`);
      continue;
    }
    report.applied.push(pf.filename);
  }

  return report;
}

// run migrations using an existing pool connection
export interface RunOptions {
  // the legacy-ledger transition belongs to the canonical stream; a caller pointing the
  // runner at some other directory must not have its real ledger re-pointed
  transitionLedger?: boolean;
}

export async function runMigrations(
  conn: any,
  migrationDir: string,
  options: RunOptions = {}
): Promise<MigrationResult> {
  const result: MigrationResult = { totalFiles: 0, alreadyApplied: 0, newlyApplied: 0, noopStatements: 0, errors: [] };

  if (!fs.existsSync(migrationDir)) {
    result.errors.push(`Migration directory not found: ${migrationDir}`);
    return result;
  }

  const allFiles = fs.readdirSync(migrationDir).filter(f => f.endsWith('.sql'));

  // strict validation before any DDL
  const { parsed, errors: validationErrors } = validateFiles(allFiles);
  if (validationErrors.length > 0) {
    result.errors.push(...validationErrors);
    return result; // exit without ledger mutation
  }

  result.totalFiles = parsed.length;
  console.log(`Migration: found ${parsed.length} files in ${migrationDir}`);

  const locked = await acquireLock(conn);
  if (!locked) {
    result.errors.push('Could not acquire migration lock. Another migration may be running.');
    return result;
  }

  try {
    await ensureLedger(conn);

    // a ledger written under the previous numbering must be re-pointed before any version
    // comparison, otherwise every renumbered file looks like a version conflict
    const transition = options.transitionLedger === false
      ? { transitioned: [], retired: [], errors: [] }
      : await applyLedgerTransition(conn, migrationDir);
    if (transition.errors.length > 0) {
      result.errors.push(...transition.errors);
      return result;
    }
    if (transition.transitioned.length > 0 || transition.retired.length > 0) {
      console.log(
        `Migration: ledger transitioned (${transition.transitioned.length} remapped, ${transition.retired.length} retired)`
      );
    }

    const applied = await getAppliedMigrations(conn);
    console.log(`Migration: ${applied.size} already applied`);

    for (const pf of parsed) {
      const filePath = path.join(migrationDir, pf.filename);
      const content = fs.readFileSync(filePath, 'utf-8');
      const sha256 = computeSha256(content);

      const existing = applied.get(pf.filename);

      if (existing) {
        if (existing.sha256 !== sha256) {
          const msg = `MIGRATION_CHECKSUM_MISMATCH: ${pf.filename} (ledger=${existing.sha256.substring(0, 12)}... current=${sha256.substring(0, 12)}...)`;
          console.error(msg);
          result.errors.push(msg);
          return result;
        }
        result.alreadyApplied++;
        continue;
      }

      // cross-validate: check no other file was already applied with this version number
      for (const [appliedFile, appliedRow] of applied) {
        if (appliedRow.version === pf.version && appliedFile !== pf.filename) {
          const msg = `VERSION_CONFLICT: version ${pf.version} already applied as "${appliedFile}", cannot apply "${pf.filename}" with same version`;
          console.error(msg);
          result.errors.push(msg);
          return result;
        }
      }

      console.log(`Migration: applying ${pf.filename} ...`);
      const statements = splitStatements(content);

      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];

        // compile immediately before execution so the preflight observes schema
        // changes made by earlier statements in this same file
        let compiled;
        try {
          compiled = await compileDdl(stmt, conn);
        } catch (err: any) {
          const errMsg = `[FAIL] Preflight for statement ${i + 1} in ${pf.filename}: ${err.message}`;
          console.error(errMsg);
          result.errors.push(errMsg);
          return result;
        }

        if (compiled.sql === null) {
          result.noopStatements += compiled.skipped.length || 1;
          continue;
        }

        try {
          await conn.query(compiled.sql);
        } catch (err: any) {
          // no generic skipping: any error is a hard failure
          const errMsg = `[FAIL] Statement ${i + 1} in ${pf.filename}: ${err.message}`;
          console.error(errMsg);
          console.error(`  SQL: ${compiled.sql.substring(0, 200)}`);
          result.errors.push(errMsg);
          return result; // do NOT record as applied
        }
      }

      // only record after all statements succeed
      await conn.execute(
        'INSERT INTO _migration_ledger (version, filename, sha256, applied_by) VALUES (?, ?, ?, ?)',
        [pf.version, pf.filename, sha256, 'migration_runner']
      );

      result.newlyApplied++;
      console.log(`  Applied: ${pf.filename}`);
    }
  } finally {
    await releaseLock(conn);
  }

  return result;
}

// return current schema version info for health checks
export async function schemaVersion(conn: any): Promise<{ version: number; totalApplied: number; checksumDigest: string }> {
  try {
    await ensureLedger(conn);
    const [rows]: any = await conn.execute(
      'SELECT version, sha256 FROM _migration_ledger ORDER BY version ASC'
    );
    if (!rows || rows.length === 0) {
      return { version: 0, totalApplied: 0, checksumDigest: '' };
    }
    const combined = rows.map((r: any) => r.sha256).join('');
    const digest = crypto.createHash('sha256').update(combined, 'utf-8').digest('hex').substring(0, 16);
    const latest = rows[rows.length - 1].version;
    return { version: latest, totalApplied: rows.length, checksumDigest: digest };
  } catch {
    return { version: -1, totalApplied: 0, checksumDigest: 'error' };
  }
}

