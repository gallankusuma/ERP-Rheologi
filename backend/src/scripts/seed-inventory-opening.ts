import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { money, moneyRound, qtyRound, toDbString } from '../lib/decimal';
import { reconcileInventory } from '../services/reconciliation.service';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Give existing stock a lot and a value, and put that value in the ledger.
//
// Stock that has no lot and no cost layer cannot be shipped or issued to a work order: the
// posting services require an exact lot and refuse to move goods they cannot value. That is
// the invariant working, not a bug, and the fix is not to loosen it but to state what the
// stock is worth.
//
// Three rules this follows, all learned the hard way elsewhere in this system:
//
//   Only what is listed is touched. A product with no line in the valuation file is skipped,
//   which is how salary, tax, consulting and equipment - all of which have stock rows here
//   because they were bought through purchase orders - stay off the balance sheet as inventory.
//
//   Value and ledger move together. Creating cost layers without a journal would put the
//   subledger ahead of the ledger by exactly their value, which is the mistake that produced
//   the phantom payables. One opening journal is posted for the same total.
//
//   It proves itself. Reconciliation runs at the end and compares shelf, valuation and ledger.
//   If they do not agree the run is reported as failed, whatever else it printed.
//
// Usage:
//   npm run seed:inventory-opening -- --file valuation.csv                 (dry run)
//   npm run seed:inventory-opening -- --file valuation.csv --apply --date 2026-08-31
//
// valuation.csv:  sku,unit_cost      one line per product, header optional

interface Row { sku: string; unitCost: string }

const args = process.argv.slice(2);
const argOf = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const APPLY = args.includes('--apply');
const FILE = argOf('file');
const AS_OF = argOf('date') || new Date().toISOString().slice(0, 10);
const EQUITY_ROLE = argOf('equity-role') || 'RETAINED_EARNINGS';
// Anyone reading the ledger later should be able to tell a rehearsal from the real opening
// position without having to ask, so the note travels with the journal itself.
const NOTE = argOf('note') || '';

function readValuation(file: string): Row[] {
  const text = fs.readFileSync(file, 'utf8');
  const out: Row[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    // a trailing # comment carries the product name and quantity, which makes the file
    // readable while filling it in; it is not part of the value
    const [sku, rest] = line.split(',');
    if (rest === undefined) continue;
    const cost = rest.split('#')[0].trim();
    const skuTrim = String(sku).trim();
    if (!skuTrim || !cost) continue;
    if (skuTrim.toLowerCase() === 'sku') continue; // header
    const value = money(cost);
    if (value.isNaN()) throw new Error(`${skuTrim}: "${cost}" is not a number`);
    if (value.isNegative()) throw new Error(`${skuTrim}: unit cost cannot be negative`);
    out.push({ sku: skuTrim, unitCost: toDbString(moneyRound(value)) });
  }
  return out;
}

/** which inventory account a product's value belongs in, from its SKU family */
function roleForSku(sku: string): string {
  if (sku.startsWith('IFG')) return 'INVENTORY_FG_AVAILABLE';
  if (sku.startsWith('PM-')) return 'INVENTORY_PKG';
  return 'INVENTORY_RM_AVAILABLE';
}

async function main() {
  if (!FILE) {
    console.error('Usage: --file <valuation.csv> [--apply] [--date YYYY-MM-DD] [--equity-role ROLE]');
    process.exit(2);
  }

  const valuation = readValuation(FILE);
  const bySku = new Map(valuation.map(r => [r.sku, r.unitCost]));
  console.log(`Valuation file: ${valuation.length} product(s)`);
  console.log(APPLY ? 'MODE: apply' : 'MODE: dry run — nothing will be written');
  console.log('');

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
    multipleStatements: false,
  });

  try {
    const [stockRows]: any = await conn.query(
      `SELECT s.id, s.product_id, s.warehouse_id, s.quantity, s.status, s.lot_id,
              p.sku, p.name
         FROM inventory_stocks s
         JOIN products p ON p.id = s.product_id
        WHERE s.quantity > 0
        ORDER BY p.sku, s.id`
    );

    const planned: any[] = [];
    const skipped: any[] = [];
    for (const s of stockRows) {
      const unitCost = bySku.get(s.sku);
      if (unitCost === undefined) {
        skipped.push(s);
        continue;
      }
      const qty = qtyRound(money(String(s.quantity)));
      planned.push({ ...s, unitCost, qty, total: moneyRound(qty.times(money(unitCost))) });
    }

    console.log('WILL BE VALUED');
    let total = money('0');
    const byRole = new Map<string, ReturnType<typeof money>>();
    for (const p of planned) {
      total = total.plus(p.total);
      const role = roleForSku(p.sku);
      byRole.set(role, (byRole.get(role) || money('0')).plus(p.total));
      console.log(
        `  ${String(p.sku).padEnd(14)} ${String(p.name).slice(0, 26).padEnd(28)}` +
        `qty ${toDbString(p.qty, 4).padStart(14)} x ${p.unitCost.padStart(14)} = ${toDbString(p.total).padStart(18)}` +
        (p.lot_id ? `  (lot ${p.lot_id})` : '  (new lot)')
      );
    }
    console.log(`  ${''.padEnd(42)}${'TOTAL'.padStart(35)} ${toDbString(moneyRound(total)).padStart(18)}`);
    console.log('');

    // Everything absent from the file is left exactly as it is. That is the mechanism, not an
    // oversight: it is how non-inventory purchases stay out of the inventory accounts.
    if (skipped.length) {
      console.log(`NOT IN THE FILE — left untouched (${skipped.length} stock row(s))`);
      const seen = new Set<string>();
      for (const s of skipped) {
        if (seen.has(s.sku)) continue;
        seen.add(s.sku);
        console.log(`  ${String(s.sku).padEnd(14)} ${String(s.name).slice(0, 40)}`);
      }
      console.log('');
    }

    console.log('LEDGER ENTRY THAT WOULD BE POSTED');
    for (const [role, amount] of byRole) {
      console.log(`  Dr  ${role.padEnd(28)} ${toDbString(moneyRound(amount)).padStart(18)}`);
    }
    console.log(`      Cr  ${EQUITY_ROLE.padEnd(26)} ${toDbString(moneyRound(total)).padStart(18)}`);
    console.log('');

    if (!APPLY) {
      console.log('Dry run: nothing written. Re-run with --apply to post it.');
      return;
    }
    if (planned.length === 0) {
      console.log('Nothing to value.');
      return;
    }

    await conn.beginTransaction();

    const [periodRows]: any = await conn.query(
      `SELECT id, status FROM fiscal_periods WHERE ? BETWEEN start_date AND end_date`, [AS_OF]
    );
    const period = periodRows[0];
    if (!period) throw new Error(`No fiscal period covers ${AS_OF}`);
    if (period.status !== 'open') throw new Error(`Period covering ${AS_OF} is ${period.status}`);

    const accountFor = async (role: string) => {
      const [r]: any = await conn.query('SELECT account_id FROM account_roles WHERE role_code = ? LIMIT 1', [role]);
      if (!r[0]) throw new Error(`No account mapped to role ${role}`);
      return r[0].account_id;
    };

    const [je]: any = await conn.query(
      `INSERT INTO journal_entries
       (entry_number, entry_date, posting_date, fiscal_period_id, description, journal_type, status,
        total_debit, total_credit, created_by, posted_at)
       VALUES (?, ?, ?, ?, ?, 'OPENING', 'posted', ?, ?, 1, NOW())`,
      [
        `OPEN-INV-${AS_OF}${NOTE ? '-' + NOTE.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 12) : ''}`,
        AS_OF, AS_OF, period.id,
        'Opening inventory valuation' + (NOTE ? ` (${NOTE})` : ''),
        toDbString(moneyRound(total)), toDbString(moneyRound(total)),
      ]
    );
    const journalId = je.insertId;

    let lineNo = 0;
    for (const [role, amount] of byRole) {
      await conn.query(
        `INSERT INTO journal_lines (journal_entry_id, line_number, account_id, description, debit, credit)
         VALUES (?, ?, ?, ?, ?, 0)`,
        [journalId, ++lineNo, await accountFor(role),
         `Opening inventory — ${role}` + (NOTE ? ` (${NOTE})` : ''), toDbString(moneyRound(amount))]
      );
    }
    await conn.query(
      `INSERT INTO journal_lines (journal_entry_id, line_number, account_id, description, debit, credit)
       VALUES (?, ?, ?, ?, 0, ?)`,
      [journalId, ++lineNo, await accountFor(EQUITY_ROLE), 'Opening inventory', toDbString(moneyRound(total))]
    );

    let lotsCreated = 0;
    let layersCreated = 0;
    for (const p of planned) {
      let lotId = p.lot_id;
      if (!lotId) {
        const lotNumber = `OPEN-${p.sku}-${p.id}`;
        const [lot]: any = await conn.query(
          `INSERT INTO inventory_lots (lot_number, product_id, source_type, source_document_id, source_line_id)
           VALUES (?, ?, 'opening', ?, ?)`,
          [lotNumber, p.product_id, journalId, p.id]
        );
        lotId = lot.insertId;
        await conn.query('UPDATE inventory_stocks SET lot_id = ? WHERE id = ?', [lotId, p.id]);
        lotsCreated++;
      }

      const [existing]: any = await conn.query(
        'SELECT id FROM inventory_cost_layers WHERE lot_id = ? AND product_id = ?', [lotId, p.product_id]
      );
      if (existing.length > 0) continue;

      await conn.query(
        `INSERT INTO inventory_cost_layers
         (lot_id, product_id, warehouse_id, source_type, source_document_id, source_line_id,
          quantity_received, quantity_remaining, quantity_allocated,
          unit_material_cost, unit_landed_cost, unit_cost, total_cost, journal_entry_id, created_by)
         VALUES (?, ?, ?, 'opening', ?, ?, ?, ?, 0, ?, 0, ?, ?, ?, 1)`,
        [
          lotId, p.product_id, p.warehouse_id, journalId, p.id,
          toDbString(p.qty, 4), toDbString(p.qty, 4),
          p.unitCost, p.unitCost, toDbString(p.total), journalId,
        ]
      );
      layersCreated++;
    }

    await conn.commit();
    console.log(`Posted journal ${journalId}: ${lotsCreated} lot(s), ${layersCreated} cost layer(s).`);
    console.log('');

    // the run is only successful if the three records agree afterwards
    const recon = await reconcileInventory(conn, AS_OF);
    console.log('RECONCILIATION');
    console.log(`  cost layers : ${recon.costLayerValue}`);
    console.log(`  ledger      : ${recon.ledgerValue}`);
    console.log(`  difference  : ${recon.difference}`);
    console.log(`  lot breaches: ${recon.lotBreaches.length}, layer breaches: ${recon.layerBreaches.length}`);
    if (!recon.balanced) {
      console.log('');
      console.log('NOT BALANCED — the opening entry does not match what the shelf now carries.');
      process.exitCode = 1;
      return;
    }
    console.log('  balanced.');
  } catch (err: any) {
    try { await conn.rollback(); } catch { /* not in a transaction */ }
    console.error('Failed:', err.message);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}

main().catch(err => {
  console.error('Seeder crashed:', err);
  process.exit(1);
});
