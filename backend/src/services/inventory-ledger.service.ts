import { dbAll, dbGet } from '../config/database';

// closed registry of movement types and their physical quantity effects
// positive = adds to physical stock, negative = removes, zero = status change only
// 'signed' means the effect direction comes from the quantity sign itself
const MOVEMENT_EFFECTS: Record<string, 'in' | 'out' | 'neutral' | 'signed'> = {
  'inbound': 'in',
  'in': 'in',
  'grn': 'in',
  'fg_receipt': 'in',
  'adjustment_in': 'in',
  'transfer_in': 'in',
  'reversal_in': 'in',
  'outbound': 'out',
  'out': 'out',
  'issue': 'out',
  'shipment': 'out',
  'adjustment_out': 'out',
  'transfer_out': 'out',
  'reversal_out': 'out',
  'adjustment': 'signed',    // generic adjustment: direction from qty sign
  'qc_release': 'neutral',   // hold -> available, no physical qty change
  'qc_hold': 'neutral',      // available -> hold, no physical qty change
};

function getPhysicalEffect(movementType: string, qty: number): number {
  const effectType = MOVEMENT_EFFECTS[movementType];
  if (effectType === undefined) {
    // unknown type: do not guess, treat as zero (reconciliation will catch it)
    return 0;
  }
  switch (effectType) {
    case 'in': return Math.abs(qty);
    case 'out': return -Math.abs(qty);
    case 'signed': return qty; // use signed quantity directly
    case 'neutral': return 0;
  }
}

interface StockCardQuery {
  productId: number;
  warehouseId?: number;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: { movedAt: string; id: number };
}

interface StockCardMovement {
  id: number;
  product_id: number;
  warehouse_id: number;
  movement_type: string;
  quantity: number;
  delta_quantity: number;
  balance_after: number;
  physical_effect: string;
  reference_type: string;
  reference_id: number;
  lot_id: number | null;
  batch_number: string | null;
  notes: string | null;
  moved_at: string;
  product_name: string;
  sku: string;
  warehouse_name: string;
  created_by_name: string | null;
}

interface StockCardResult {
  opening_quantity: number;
  closing_quantity: number;
  movements: StockCardMovement[];
  as_of: string;
  product_id: number;
  warehouse_id: number | null;
}

// posted-event filter: only movements with real stock effect
// excludes pending/rejected stock adjustments (approval_status 0 or 1)
function buildPostedFilter(): string {
  return `(
    sm.movement_type != 'adjustment'
    OR sm.reference_type NOT IN ('stock_adjustment', 'ADJUSTMENT')
    OR sm.approval_status IS NULL
    OR sm.approval_status = 2
  )`;
}

// SQL CASE expression for physical effect calculation (mirrors MOVEMENT_EFFECTS)
function buildEffectCase(): string {
  return `CASE
    WHEN sm.movement_type IN ('inbound','in','grn','fg_receipt','adjustment_in','transfer_in','reversal_in') THEN ABS(sm.quantity)
    WHEN sm.movement_type IN ('outbound','out','issue','shipment','adjustment_out','transfer_out','reversal_out') THEN -ABS(sm.quantity)
    WHEN sm.movement_type = 'adjustment' THEN sm.quantity
    WHEN sm.movement_type IN ('qc_release','qc_hold') THEN 0
    ELSE 0
  END`;
}

// compute authoritative opening balance from all posted movements before the window
async function computeOpeningBalance(productId: number, warehouseId: number | undefined, before: string | undefined): Promise<number> {
  if (!before) {
    return 0;
  }

  const conditions = ['sm.product_id = ?'];
  const params: any[] = [productId];

  if (warehouseId) {
    conditions.push('sm.warehouse_id = ?');
    params.push(warehouseId);
  }

  conditions.push('sm.moved_at < ?');
  params.push(before + ' 00:00:00');
  conditions.push(buildPostedFilter());

  const row = await dbGet(`
    SELECT COALESCE(SUM(${buildEffectCase()}), 0) as opening_qty
    FROM stock_movements sm
    WHERE ${conditions.join(' AND ')}
  `, params);

  return Number((row as any)?.opening_qty || 0);
}

// compute balance for all rows before a cursor position (for pagination)
async function computeBalanceBeforeCursor(
  productId: number,
  warehouseId: number | undefined,
  from: string | undefined,
  cursor: { movedAt: string; id: number }
): Promise<number> {
  const conditions = ['sm.product_id = ?'];
  const params: any[] = [productId];

  if (warehouseId) {
    conditions.push('sm.warehouse_id = ?');
    params.push(warehouseId);
  }
  if (from) {
    conditions.push('sm.moved_at >= ?');
    params.push(from + ' 00:00:00');
  }

  // all rows before cursor (exclusive)
  conditions.push('(sm.moved_at < ? OR (sm.moved_at = ? AND sm.id < ?))');
  params.push(cursor.movedAt, cursor.movedAt, cursor.id);
  conditions.push(buildPostedFilter());

  const row = await dbGet(`
    SELECT COALESCE(SUM(${buildEffectCase()}), 0) as balance_sum
    FROM stock_movements sm
    WHERE ${conditions.join(' AND ')}
  `, params);

  return Number((row as any)?.balance_sum || 0);
}

// main query service
export async function queryStockCard(query: StockCardQuery): Promise<StockCardResult> {
  const { productId, warehouseId, from, to, limit, cursor } = query;

  // 1. compute opening balance (all posted events before 'from')
  const openingQty = await computeOpeningBalance(productId, warehouseId, from);

  // 2. build movement query
  const conditions = ['sm.product_id = ?'];
  const params: any[] = [productId];

  if (warehouseId) {
    conditions.push('sm.warehouse_id = ?');
    params.push(warehouseId);
  }
  if (from) {
    conditions.push('sm.moved_at >= ?');
    params.push(from + ' 00:00:00');
  }
  if (to) {
    conditions.push('sm.moved_at <= ?');
    params.push(to + ' 23:59:59');
  }
  conditions.push(buildPostedFilter());

  // cursor-based pagination
  if (cursor) {
    conditions.push('(sm.moved_at > ? OR (sm.moved_at = ? AND sm.id > ?))');
    params.push(cursor.movedAt, cursor.movedAt, cursor.id);
  }

  const where = 'WHERE ' + conditions.join(' AND ');

  let limitClause = '';
  if (limit) {
    limitClause = ` LIMIT ${Number(limit)}`;
  }

  const rows = await dbAll(`
    SELECT
      sm.id,
      sm.product_id,
      sm.warehouse_id,
      sm.movement_type,
      sm.quantity,
      sm.reference_type,
      sm.reference_id,
      sm.lot_id,
      sm.batch_number,
      sm.notes,
      sm.moved_at,
      sm.created_at,
      p.name as product_name,
      p.sku,
      w.name as warehouse_name,
      u.full_name as created_by_name
    FROM stock_movements sm
    JOIN products p ON sm.product_id = p.id
    LEFT JOIN warehouses w ON sm.warehouse_id = w.id
    LEFT JOIN users u ON sm.created_by = u.id
    ${where}
    ORDER BY sm.moved_at ASC, sm.id ASC
    ${limitClause}
  `, params);

  // 3. compute starting balance for this page
  let runningBalance: number;
  if (cursor) {
    // cursor pagination: opening + all events before cursor
    runningBalance = openingQty + await computeBalanceBeforeCursor(productId, warehouseId, from, cursor);
  } else {
    runningBalance = openingQty;
  }

  // 4. compute running balance
  const movements: StockCardMovement[] = [];

  for (const row of rows as any[]) {
    const delta = getPhysicalEffect(row.movement_type, Number(row.quantity));
    runningBalance += delta;

    let effectLabel = 'neutral';
    if (delta > 0) effectLabel = 'in';
    else if (delta < 0) effectLabel = 'out';

    movements.push({
      id: row.id,
      product_id: row.product_id,
      warehouse_id: row.warehouse_id,
      movement_type: row.movement_type,
      quantity: Number(row.quantity),
      delta_quantity: delta,
      balance_after: runningBalance,
      physical_effect: effectLabel,
      reference_type: row.reference_type,
      reference_id: row.reference_id,
      lot_id: row.lot_id || null,
      batch_number: row.batch_number || null,
      notes: row.notes,
      moved_at: row.moved_at,
      product_name: row.product_name,
      sku: row.sku,
      warehouse_name: row.warehouse_name,
      created_by_name: row.created_by_name,
    });
  }

  return {
    opening_quantity: openingQty,
    closing_quantity: runningBalance,
    movements,
    as_of: new Date().toISOString(),
    product_id: productId,
    warehouse_id: warehouseId || null,
  };
}
