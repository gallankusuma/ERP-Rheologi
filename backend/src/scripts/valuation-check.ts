import path from 'path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { resolveValuation, ValuationError } from '../services/valuation-policy.service';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Proves the valuation invariant on a throwaway database: a stock event either carries a
// value, or is explicitly approved as zero-value. It never passes silently.

const DISPOSABLE_PREFIX = 'erp_valcheck_';
const BUSINESS_DATE = '2026-08-23';

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

async function expectRejected(conn: any, label: string, unitCost: any, quantity: string, eventType = 'GRN_POSTED') {
  try {
    await resolveValuation(conn, {
      sourceEventType: eventType,
      businessDate: BUSINESS_DATE,
      quantity,
      unitCost,
      context: { case: label },
    });
    record(label, false, 'posting was allowed with no value');
  } catch (err: any) {
    const isValuation = err instanceof ValuationError && err.code === 'VALUATION_REQUIRED' && err.httpStatus === 422;
    record(label, isValuation, isValuation ? '422 VALUATION_REQUIRED' : `unexpected: ${err.message}`);
  }
}

async function main() {
  const dbName = `${DISPOSABLE_PREFIX}${process.pid}_${Date.now()}`;
  assertDisposable(dbName);

  const admin = await mysql.createConnection(serverConfig());
  await admin.query(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  const conn = await mysql.createConnection({ ...serverConfig(), database: dbName });

  try {
    await conn.query(
      `CREATE TABLE posting_profiles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT DEFAULT 1,
        source_event_type VARCHAR(50) NOT NULL,
        profile_name VARCHAR(100) NOT NULL,
        zero_value_reason VARCHAR(255) NULL,
        is_active TINYINT(1) DEFAULT 1,
        effective_from DATE NOT NULL DEFAULT '2025-01-01',
        effective_to DATE DEFAULT NULL,
        approved_by INT DEFAULT NULL,
        approved_at TIMESTAMP NULL DEFAULT NULL
      ) ENGINE=InnoDB`
    );

    // a priced receipt posts, and the amount is exact decimal arithmetic
    const priced = await resolveValuation(conn, {
      sourceEventType: 'GRN_POSTED',
      businessDate: BUSINESS_DATE,
      quantity: '3',
      unitCost: '0.1',
      context: {},
    });
    record(
      'priced receipt values with exact decimal arithmetic',
      priced.amount === '0.3000' && !priced.statistical,
      `amount=${priced.amount} (JavaScript 3 * 0.1 = ${3 * 0.1})`
    );

    await expectRejected(conn, 'zero unit cost is refused without an approved profile', '0', '10');
    await expectRejected(conn, 'missing unit cost is refused without an approved profile', null, '10');
    await expectRejected(conn, 'negative value is refused', '-5', '10');

    // an unapproved profile row must not unlock zero-value posting
    await conn.query(
      `INSERT INTO posting_profiles (source_event_type, profile_name, is_active, approved_by, approved_at)
       VALUES ('GRN_POSTED', 'ZERO_VALUE_ALLOWED', 1, NULL, NULL)`
    );
    await expectRejected(conn, 'unapproved zero-value profile does not unlock posting', '0', '10');

    // approved, active and effective: now permitted, recorded as statistical
    await conn.query(
      `UPDATE posting_profiles SET approved_by = 1, approved_at = NOW(), zero_value_reason = 'free sample'
        WHERE source_event_type = 'GRN_POSTED'`
    );
    const approved = await resolveValuation(conn, {
      sourceEventType: 'GRN_POSTED',
      businessDate: BUSINESS_DATE,
      quantity: '10',
      unitCost: '0',
      context: {},
    });
    record(
      'approved zero-value profile yields a statistical event',
      approved.statistical && approved.amount === '0' && !!approved.profileId,
      `statistical=${approved.statistical}, profile=${approved.profileId}`
    );

    // approval is scoped to the event type it was granted for
    await expectRejected(conn, 'approval does not leak to other event types', '0', '10', 'FG_RECEIVED');
    const otherEvent = await resolveValuation(conn, {
      sourceEventType: 'FG_RECEIVED',
      businessDate: BUSINESS_DATE,
      quantity: '10',
      unitCost: '5',
      context: {},
    }).then(r => r).catch(() => null);
    record('unrelated event type still values normally', otherEvent?.amount === '50.0000', `amount=${otherEvent?.amount}`);

    // an expired profile must stop permitting zero value
    await conn.query(`UPDATE posting_profiles SET effective_to = '2026-01-01' WHERE source_event_type = 'GRN_POSTED'`);
    await expectRejected(conn, 'expired zero-value profile no longer applies', '0', '10');
  } catch (err: any) {
    record('valuation check completed without unexpected error', false, err.message);
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
  console.error('Valuation check crashed:', err);
  process.exit(1);
});
