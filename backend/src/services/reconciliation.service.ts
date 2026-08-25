import { money, moneyRound, toDbString } from '../lib/decimal';

// Inventory reconciliation.
//
// Three records describe the same goods and must agree:
//
//   what is on the shelf   inventory_stocks.quantity
//   what it is worth       inventory_cost_layers.quantity_remaining * unit_cost
//   what the ledger says   the balance of the inventory control accounts
//
// Each is written by a different code path, so they drift silently unless something compares
// them. This is what turns "the postings looked right" into a number that can be checked.

// balances held against these roles are inventory the ledger believes we own
const INVENTORY_ROLES = [
  'INVENTORY_RM_AVAILABLE',
  'INVENTORY_RM_QC_HOLD',
  'INVENTORY_FG_AVAILABLE',
  'INVENTORY_FG_QC_HOLD',
  'INVENTORY_PKG',
  'INVENTORY_WIP',
];

/** stock statuses that represent goods we still hold */
const HELD_STATUSES = ['available', 'qc_hold'];

export interface LayerBreach {
  costLayerId: number;
  lotId: number;
  received: string;
  remaining: string;
  allocated: string;
  difference: string;
}

export interface LotBreach {
  lotId: number;
  productId: number;
  physicalQuantity: string;
  valuedQuantity: string;
  difference: string;
}

export interface InventoryReconciliation {
  asOf: string;
  /** Σ quantity_remaining × unit_cost across every cost layer */
  costLayerValue: string;
  /** balance of the inventory control accounts, from posted journals only */
  ledgerValue: string;
  difference: string;
  balanced: boolean;
  /** layers where received ≠ remaining + allocated */
  layerBreaches: LayerBreach[];
  /** lots where the shelf and the valuation disagree on quantity */
  lotBreaches: LotBreach[];
}

export async function reconcileInventory(conn: any, asOfDate?: string): Promise<InventoryReconciliation> {
  const asOf = asOfDate || new Date().toISOString().slice(0, 10);

  // what the cost layers say the goods are worth
  const [valueRows]: any = await conn.query(
    `SELECT COALESCE(SUM(quantity_remaining * unit_cost), 0) AS value FROM inventory_cost_layers`
  );
  const costLayerValue = moneyRound(money(String(valueRows[0].value)));

  // what the ledger says, from posted journals only
  const [ledgerRows]: any = await conn.query(
    `SELECT COALESCE(SUM(CASE WHEN coa.normal_balance = 'credit'
                              THEN COALESCE(jl.credit, 0) - COALESCE(jl.debit, 0)
                              ELSE COALESCE(jl.debit, 0) - COALESCE(jl.credit, 0) END), 0) AS value
       FROM journal_lines jl
       JOIN journal_entries je ON je.id = jl.journal_entry_id AND je.status = 'posted'
       JOIN chart_of_accounts coa ON coa.id = jl.account_id
      WHERE je.posting_date <= ?
        AND coa.id IN (
          SELECT account_id FROM account_roles WHERE role_code IN (${INVENTORY_ROLES.map(() => '?').join(',')})
        )`,
    [asOf, ...INVENTORY_ROLES]
  );
  const ledgerValue = moneyRound(money(String(ledgerRows[0].value)));

  // a layer must account for everything it received
  const [breachRows]: any = await conn.query(
    `SELECT id, lot_id, quantity_received, quantity_remaining, quantity_allocated
       FROM inventory_cost_layers
      WHERE ABS(quantity_received - (quantity_remaining + quantity_allocated)) > 0.00005
      ORDER BY id`
  );
  const layerBreaches: LayerBreach[] = breachRows.map((r: any) => ({
    costLayerId: r.id,
    lotId: r.lot_id,
    received: String(r.quantity_received),
    remaining: String(r.quantity_remaining),
    allocated: String(r.quantity_allocated),
    difference: toDbString(
      moneyRound(money(String(r.quantity_received)).minus(money(String(r.quantity_remaining)).plus(money(String(r.quantity_allocated)))))
    ),
  }));

  // the shelf and the valuation must agree on how much of each lot is left
  const [lotRows]: any = await conn.query(
    `SELECT lot.lot_id,
            lot.product_id,
            COALESCE(stock.qty, 0) AS physical,
            COALESCE(layer.qty, 0) AS valued
       FROM (
         SELECT id AS lot_id, product_id FROM inventory_lots
       ) lot
       LEFT JOIN (
         SELECT lot_id, SUM(quantity) AS qty FROM inventory_stocks
          WHERE status IN (${HELD_STATUSES.map(() => '?').join(',')}) AND lot_id IS NOT NULL
          GROUP BY lot_id
       ) stock ON stock.lot_id = lot.lot_id
       LEFT JOIN (
         SELECT lot_id, SUM(quantity_remaining) AS qty FROM inventory_cost_layers GROUP BY lot_id
       ) layer ON layer.lot_id = lot.lot_id
      HAVING ABS(physical - valued) > 0.00005
      ORDER BY lot.lot_id`,
    HELD_STATUSES
  );
  const lotBreaches: LotBreach[] = lotRows.map((r: any) => ({
    lotId: r.lot_id,
    productId: r.product_id,
    physicalQuantity: String(r.physical),
    valuedQuantity: String(r.valued),
    difference: toDbString(moneyRound(money(String(r.physical)).minus(money(String(r.valued))))),
  }));

  const difference = moneyRound(costLayerValue.minus(ledgerValue));

  return {
    asOf,
    costLayerValue: toDbString(costLayerValue),
    ledgerValue: toDbString(ledgerValue),
    difference: toDbString(difference),
    balanced: difference.isZero() && layerBreaches.length === 0 && lotBreaches.length === 0,
    layerBreaches,
    lotBreaches,
  };
}
