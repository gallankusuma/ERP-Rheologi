import path from 'path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { freezeGrnLines } from '../services/procurement.service';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Proves that goods receipt lines are derived from the purchase order rather than trusted
// from the request, and that one PO line cannot be received twice on one receipt.

const DISPOSABLE_PREFIX = 'erp_grncheck_';

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

// PO line 101 is product 10 at 1500; PO line 102 is product 20 at 2000
const poItemById = new Map<number, any>([
  [101, { id: 101, product_id: 10, quantity: '10.0000', received_qty: '0.0000', unit_price: '1500.0000' }],
  [102, { id: 102, product_id: 20, quantity: '5.0000', received_qty: '0.0000', unit_price: '2000.0000' }],
]);

function draft(items: any[]) {
  return JSON.stringify({ items });
}

async function expectRejected(conn: any, label: string, grnId: number, notes: string, expectedCode: string) {
  try {
    await freezeGrnLines(conn, grnId, notes, poItemById);
    record(label, false, 'the line was accepted');
  } catch (err: any) {
    record(label, err.code === expectedCode, err.code ? `${err.code} (${err.httpStatus})` : err.message);
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
      `CREATE TABLE grn_lines (
        id INT PRIMARY KEY AUTO_INCREMENT,
        grn_id INT NOT NULL,
        po_item_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity_received DECIMAL(20,4) NOT NULL,
        unit_cost DECIMAL(20,4) NOT NULL DEFAULT 0,
        currency VARCHAR(10) NOT NULL DEFAULT 'IDR',
        batch_number VARCHAR(100) NULL,
        remarks TEXT NULL,
        frozen_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_grn_line (grn_id, po_item_id)
      ) ENGINE=InnoDB`
    );

    // a well-formed receipt freezes with the product and price taken from the PO
    const good = await freezeGrnLines(conn, 1, draft([{ po_item_id: 101, received_quantity: '4' }]), poItemById);
    record(
      'line derives product and price from the purchase order',
      good.length === 1 && good[0].product_id === 10 && Number(good[0].unit_cost) === 1500,
      `product=${good[0]?.product_id}, unit_cost=${good[0]?.unit_cost}`
    );

    // a caller naming a different product than the PO line must be refused
    await expectRejected(
      conn,
      'a forged product on a valid PO line is refused',
      2,
      draft([{ po_item_id: 101, product_id: 999, received_quantity: '4' }]),
      'INVALID_GRN_LINE'
    );

    // two lines against the same PO item would each pass a ceiling check individually
    await expectRejected(
      conn,
      'the same PO line twice on one receipt is refused',
      3,
      draft([
        { po_item_id: 101, received_quantity: '6' },
        { po_item_id: 101, received_quantity: '6' },
      ]),
      'INVALID_GRN_LINE'
    );

    await expectRejected(
      conn,
      'a PO line from another order is refused',
      4,
      draft([{ po_item_id: 999, received_quantity: '1' }]),
      'MISSING_LINEAGE'
    );

    await expectRejected(
      conn,
      'a line without PO lineage is refused',
      5,
      draft([{ product_id: 10, received_quantity: '1' }]),
      'MISSING_LINEAGE'
    );

    await expectRejected(conn, 'a receipt with no positive quantity is refused', 6, draft([{ po_item_id: 101, received_quantity: '0' }]), 'EMPTY_RECEIPT');

    // once frozen, editing the draft payload must not change what was received
    const tampered = await freezeGrnLines(
      conn,
      1,
      draft([{ po_item_id: 102, received_quantity: '99' }]),
      poItemById
    );
    record(
      'frozen lines ignore later edits to the draft payload',
      tampered.length === 1 && tampered[0].po_item_id === 101 && Number(tampered[0].quantity_received) === 4,
      `still po_item=${tampered[0]?.po_item_id}, qty=${tampered[0]?.quantity_received}`
    );

    // decimal quantities survive without binary rounding
    const dec = await freezeGrnLines(conn, 7, draft([{ po_item_id: 101, received_quantity: '0.1' }, { po_item_id: 102, received_quantity: '0.2' }]), poItemById);
    const total = dec.reduce((s, l) => s + Number(l.quantity_received), 0);
    record(
      'decimal quantities are stored exactly',
      dec.length === 2 && Number(dec[0].quantity_received) === 0.1 && Number(dec[1].quantity_received) === 0.2,
      `stored ${dec.map(d => d.quantity_received).join(' + ')} (sum reads ${total})`
    );
  } catch (err: any) {
    record('grn line check completed without unexpected error', false, err.message);
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
  console.error('GRN line check crashed:', err);
  process.exit(1);
});
