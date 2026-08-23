import type { Connection } from 'mysql2/promise';

// MariaDB accepts IF NOT EXISTS / IF EXISTS guards on ALTER clauses and CREATE/DROP INDEX.
// MySQL 8 rejects them with ER_PARSE_ERROR (1064). Instead of branching per engine, every
// guard is resolved here against INFORMATION_SCHEMA and emitted as plain DDL, so both
// engines execute byte-identical statements and local runs prove production behaviour.

export interface CompiledDdl {
  sql: string | null;
  skipped: string[];
}

type Existence = (kind: 'column' | 'index' | 'table' | 'constraint', table: string, name?: string) => Promise<boolean>;

const ALTER_HEAD = /^ALTER\s+TABLE\s+(`?)([A-Za-z0-9_$]+)\1\s+([\s\S]+)$/i;
const ADD_COLUMN_GUARD = /^ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+(`?)([A-Za-z0-9_$]+)\1(\s[\s\S]*)$/i;
const ADD_INDEX_GUARD =
  /^ADD\s+(UNIQUE\s+|FULLTEXT\s+|SPATIAL\s+)?(?:INDEX|KEY)\s+IF\s+NOT\s+EXISTS\s+(`?)([A-Za-z0-9_$]+)\2(\s*[\s\S]*)$/i;
const DROP_INDEX_GUARD = /^DROP\s+(?:INDEX|KEY)\s+IF\s+EXISTS\s+(`?)([A-Za-z0-9_$]+)\1\s*$/i;
const ADD_CONSTRAINT_GUARD = /^ADD\s+CONSTRAINT\s+IF\s+NOT\s+EXISTS\s+(`?)([A-Za-z0-9_$]+)\1(\s[\s\S]+)$/i;
const DROP_FK_GUARD = /^DROP\s+FOREIGN\s+KEY\s+IF\s+EXISTS\s+(`?)([A-Za-z0-9_$]+)\1\s*$/i;
const DROP_INDEX_STATEMENT_GUARD =
  /^DROP\s+INDEX\s+IF\s+EXISTS\s+(`?)([A-Za-z0-9_$]+)\1\s+ON\s+(`?)([A-Za-z0-9_$]+)\3\s*$/i;
const CREATE_INDEX_GUARD =
  /^CREATE\s+(UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS\s+(`?)([A-Za-z0-9_$]+)\2\s+ON\s+(`?)([A-Za-z0-9_$]+)\4\s*([\s\S]+)$/i;

// strip line and block comments that sit outside string literals
function stripComments(sql: string): string {
  let out = '';
  let quote: string | null = null;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];

    if (quote) {
      out += ch;
      if (ch === '\\' && quote !== '`') {
        if (i + 1 < sql.length) out += sql[++i];
        continue;
      }
      if (ch === quote) {
        if (sql[i + 1] === quote) {
          out += sql[++i];
          continue;
        }
        quote = null;
      }
      continue;
    }

    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      out += ch;
      continue;
    }

    if (ch === '-' && sql[i + 1] === '-' && (sql[i + 2] === undefined || /\s/.test(sql[i + 2]))) {
      while (i < sql.length && sql[i] !== '\n') i++;
      out += '\n';
      continue;
    }

    if (ch === '#') {
      while (i < sql.length && sql[i] !== '\n') i++;
      out += '\n';
      continue;
    }

    if (ch === '/' && sql[i + 1] === '*') {
      i += 2;
      while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) i++;
      i++;
      out += ' ';
      continue;
    }

    out += ch;
  }

  return out;
}

// split on commas that are not inside quotes or parentheses
function splitClauses(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let buf = '';

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];

    if (quote) {
      buf += ch;
      if (ch === '\\' && quote !== '`') {
        if (i + 1 < body.length) buf += body[++i];
        continue;
      }
      if (ch === quote) {
        if (body[i + 1] === quote) {
          buf += body[++i];
          continue;
        }
        quote = null;
      }
      continue;
    }

    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      buf += ch;
      continue;
    }
    if (ch === '(') depth++;
    if (ch === ')') depth--;

    if (ch === ',' && depth === 0) {
      parts.push(buf);
      buf = '';
      continue;
    }
    buf += ch;
  }

  if (buf.trim().length > 0) parts.push(buf);
  return parts;
}

function makeExistenceChecker(conn: Connection): Existence {
  return async (kind, table, name) => {
    if (kind === 'table') {
      const [rows]: any = await conn.query(
        'SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1',
        [table]
      );
      return rows.length > 0;
    }
    if (kind === 'constraint') {
      const [rows]: any = await conn.query(
        // TABLE_SCHEMA is what lets the server skip other schema directories; without it
        // MariaDB enumerates every database and trips over unrelated damaged ones
        'SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ? LIMIT 1',
        [table, name]
      );
      return rows.length > 0;
    }
    if (kind === 'column') {
      const [rows]: any = await conn.query(
        'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1',
        [table, name]
      );
      return rows.length > 0;
    }
    const [rows]: any = await conn.query(
      'SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1',
      [table, name]
    );
    return rows.length > 0;
  };
}

// resolve one ALTER TABLE, dropping guarded clauses whose target already matches the schema
async function compileAlter(table: string, body: string, exists: Existence): Promise<CompiledDdl> {
  const clauses = splitClauses(body);
  const kept: string[] = [];
  const skipped: string[] = [];

  for (const raw of clauses) {
    const clause = raw.trim();
    if (clause.length === 0) continue;

    const addCol = clause.match(ADD_COLUMN_GUARD);
    if (addCol) {
      const [, tick, column, rest] = addCol;
      if (await exists('column', table, column)) {
        skipped.push(`${table}.${column} (column present)`);
      } else {
        kept.push(`ADD COLUMN ${tick}${column}${tick}${rest}`);
      }
      continue;
    }

    const addIdx = clause.match(ADD_INDEX_GUARD);
    if (addIdx) {
      const [, modifier, tick, index, rest] = addIdx;
      if (await exists('index', table, index)) {
        skipped.push(`${table}.${index} (index present)`);
      } else {
        // the UNIQUE/FULLTEXT/SPATIAL modifier must survive the rewrite, or a unique
        // constraint silently degrades into an ordinary index
        kept.push(`ADD ${(modifier || '').toUpperCase()}INDEX ${tick}${index}${tick}${rest}`);
      }
      continue;
    }

    const addConstraint = clause.match(ADD_CONSTRAINT_GUARD);
    if (addConstraint) {
      const [, tick, name, rest] = addConstraint;
      if (await exists('constraint', table, name)) {
        skipped.push(`${table}.${name} (constraint present)`);
      } else {
        kept.push(`ADD CONSTRAINT ${tick}${name}${tick}${rest}`);
      }
      continue;
    }

    const dropFk = clause.match(DROP_FK_GUARD);
    if (dropFk) {
      const [, tick, name] = dropFk;
      if (await exists('constraint', table, name)) {
        kept.push(`DROP FOREIGN KEY ${tick}${name}${tick}`);
      } else {
        skipped.push(`${table}.${name} (constraint absent)`);
      }
      continue;
    }

    const dropIdx = clause.match(DROP_INDEX_GUARD);
    if (dropIdx) {
      const [, tick, index] = dropIdx;
      if (await exists('index', table, index)) {
        kept.push(`DROP INDEX ${tick}${index}${tick}`);
      } else {
        skipped.push(`${table}.${index} (index absent)`);
      }
      continue;
    }

    kept.push(clause);
  }

  if (kept.length === 0) return { sql: null, skipped };
  return { sql: `ALTER TABLE \`${table}\` ${kept.join(', ')}`, skipped };
}

/**
 * Rewrite MariaDB-only DDL guards into engine-neutral SQL using INFORMATION_SCHEMA preflight.
 * Returns sql=null when the statement is fully satisfied by the current schema.
 */
export async function compileDdl(statement: string, conn: Connection): Promise<CompiledDdl> {
  const stmt = stripComments(statement).trim();
  if (stmt.length === 0) return { sql: null, skipped: [] };

  // standalone "DROP INDEX x ON t": MariaDB accepts the guard here, MySQL 8 does not
  const dropIdxStmt = stmt.match(DROP_INDEX_STATEMENT_GUARD);
  if (dropIdxStmt) {
    const [, iTick, index, tTick, table] = dropIdxStmt;
    const exists = makeExistenceChecker(conn);
    if (!(await exists('index', table, index))) {
      return { sql: null, skipped: [`${table}.${index} (index absent)`] };
    }
    return { sql: `DROP INDEX ${iTick}${index}${iTick} ON ${tTick}${table}${tTick}`, skipped: [] };
  }

  const createIdx = stmt.match(CREATE_INDEX_GUARD);
  if (createIdx) {
    const [, unique, iTick, index, tTick, table, rest] = createIdx;
    const exists = makeExistenceChecker(conn);
    if (await exists('index', table, index)) {
      return { sql: null, skipped: [`${table}.${index} (index present)`] };
    }
    const uniqueWord = unique ? 'UNIQUE ' : '';
    return {
      sql: `CREATE ${uniqueWord}INDEX ${iTick}${index}${iTick} ON ${tTick}${table}${tTick} ${rest.trim()}`,
      skipped: [],
    };
  }

  const alter = stmt.match(ALTER_HEAD);
  if (alter) {
    const [, , table, body] = alter;
    if (!/IF\s+(NOT\s+)?EXISTS/i.test(body)) return { sql: statement, skipped: [] };
    return compileAlter(table, body, makeExistenceChecker(conn));
  }

  return { sql: statement, skipped: [] };
}

/**
 * Guard clauses in this SQL that the compiler would leave untouched.
 * MariaDB accepts several guard forms natively, so an unhandled one passes locally and
 * only fails on MySQL 8. Surfacing them lets that gap fail on the developer's machine.
 */
export function findUnsupportedGuards(sql: string): string[] {
  const unsupported: string[] = [];
  const stmt = stripComments(sql);

  const alterRe = /ALTER\s+TABLE\s+`?[A-Za-z0-9_$]+`?\s+([\s\S]*?);/gi;
  let m;
  while ((m = alterRe.exec(stmt))) {
    for (const raw of splitClauses(m[1])) {
      const clause = raw.trim();
      if (!/IF\s+(NOT\s+)?EXISTS/i.test(clause)) continue;
      const handled =
        ADD_COLUMN_GUARD.test(clause) ||
        ADD_INDEX_GUARD.test(clause) ||
        ADD_CONSTRAINT_GUARD.test(clause) ||
        DROP_INDEX_GUARD.test(clause) ||
        DROP_FK_GUARD.test(clause);
      if (!handled) unsupported.push(clause.replace(/\s+/g, ' ').slice(0, 100));
    }
  }

  // standalone index statements carry guards as well
  for (const raw of stmt.split(';')) {
    const one = raw.trim();
    if (!one || !/IF\s+(NOT\s+)?EXISTS/i.test(one)) continue;
    if (!/^(CREATE|DROP)\s+(UNIQUE\s+|FULLTEXT\s+|SPATIAL\s+)?INDEX\s/i.test(one)) continue;
    if (CREATE_INDEX_GUARD.test(one) || DROP_INDEX_STATEMENT_GUARD.test(one)) continue;
    unsupported.push(one.replace(/\s+/g, ' ').slice(0, 100));
  }

  return unsupported;
}
