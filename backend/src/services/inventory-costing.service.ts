// inventory costing service
// manages cost layers, cost allocations, and batch cost sheets
// all functions receive a transaction connection (conn) and run inside the caller's dbTransaction
// blueprint §8.8, §11

import { money, moneyRound, toDbString, Decimal } from '../lib/decimal';

export interface CostLayerInput {
  lotId: number;
  productId: number;
  warehouseId: number;
  quantity: string; // decimal string
  unitCost: string; // decimal string (PO unit_price or WIP-derived)
  sourceType: 'grn_item' | 'fg_receipt' | 'adjustment' | 'return';
  sourceDocumentId: number;
  sourceLineId: number;
  currency?: string;
  exchangeRate?: string;
  costStatus?: 'PROVISIONAL' | 'FINAL';
  journalEntryId?: number;
  createdBy: number;
}

export interface CostAllocationResult {
  /** first layer drawn; the authoritative lineage is allocationIds */
  costLayerId: number;
  /** weighted average across every layer drawn, not the last layer's rate */
  unitCost: string;
  totalCost: string;
  /** every allocation row created, so all of them can be linked to the journal */
  allocationIds: number[];
  layerIds: number[];
}

export interface BatchCostSummary {
  materialCost: string;
  directLabor: string;
  overheadAbsorbed: string;
  outsideProcessing: string;
  totalCost: string;
  acceptedOutputQty: string;
  provisionalUnitCost: string | null;
}

// create a cost layer for a receipt event (GRN or FG)
export async function createCostLayer(conn: any, input: CostLayerInput): Promise<number> {
  const qty = money(input.quantity);
  const unitMaterialCost = money(input.unitCost);
  const unitLandedCost = money('0'); // landed cost allocated separately later
  const unitCost = moneyRound(unitMaterialCost.plus(unitLandedCost));
  const totalCost = moneyRound(unitCost.times(qty));
  const rate = money(input.exchangeRate || '1');

  const [result] = await conn.execute(
    `INSERT INTO inventory_cost_layers
     (lot_id, product_id, warehouse_id,
      source_type, source_document_id, source_line_id,
      quantity_received, quantity_remaining, quantity_allocated,
      unit_material_cost, unit_landed_cost, unit_cost, total_cost,
      currency, exchange_rate, cost_status,
      journal_entry_id, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.lotId, input.productId, input.warehouseId,
      input.sourceType, input.sourceDocumentId, input.sourceLineId,
      toDbString(qty), toDbString(qty), // remaining = received initially
      toDbString(unitMaterialCost), toDbString(unitLandedCost),
      toDbString(unitCost), toDbString(totalCost),
      input.currency || 'IDR', toDbString(rate, 10),
      input.costStatus || 'PROVISIONAL',
      input.journalEntryId || null, input.createdBy,
    ]
  );

  return result.insertId;
}

// update journal reference on a cost layer (called after postSystemJournal returns)
export async function linkCostLayerToJournal(conn: any, costLayerId: number, journalEntryId: number): Promise<void> {
  await conn.execute(
    'UPDATE inventory_cost_layers SET journal_entry_id = ? WHERE id = ?',
    [journalEntryId, costLayerId]
  );
}

// allocate cost from a specific lot's cost layer for an outbound movement
// returns the unit cost and total cost for GL posting
// blueprint §11: exact lot actual cost, no averaging
export async function allocateCostFromLayer(conn: any, opts: {
  lotId: number;
  productId: number;
  quantity: string; // decimal string
  movementType: 'wo_material_issue' | 'shipment' | 'adjustment' | 'return' | 'scrap';
  movementId: number;
  journalEntryId?: number;
}): Promise<CostAllocationResult> {
  const qty = money(opts.quantity);

  // lock the cost layer for this lot
  const [layers] = await conn.execute(
    // quantity_allocated must be selected: computing the new cumulative value from an
    // unselected column silently resets it to this allocation alone
    `SELECT id, unit_cost, quantity_remaining, quantity_allocated
     FROM inventory_cost_layers
     WHERE lot_id = ? AND product_id = ?
     ORDER BY id ASC
     FOR UPDATE`,
    [opts.lotId, opts.productId]
  );

  if (!layers || layers.length === 0) {
    throw Object.assign(
      new Error(`No cost layer found for lot ${opts.lotId} product ${opts.productId}`),
      { statusCode: 422, code: 'INVENTORY_COST_MISSING' }
    );
  }

  // exact-lot: should be one layer per lot (unless landed cost adjustment created another)
  // use FIFO across layers for the same lot
  let remainingToAllocate = qty;
  let totalAllocatedCost = money('0');
  const allocationIds: number[] = [];
  const layerIds: number[] = [];

  for (const layer of layers) {
    if (remainingToAllocate.lte(0)) break;

    const layerRemaining = money(String(layer.quantity_remaining));
    if (layerRemaining.lte(0)) continue;

    const layerUnitCost = money(String(layer.unit_cost));
    const allocQty = Decimal.min(remainingToAllocate, layerRemaining);
    const allocCost = moneyRound(layerUnitCost.times(allocQty));

    // update layer remaining
    const newRemaining = moneyRound(layerRemaining.minus(allocQty));
    const newAllocated = moneyRound(money(String(layer.quantity_allocated || 0)).plus(allocQty));

    await conn.execute(
      `UPDATE inventory_cost_layers
       SET quantity_remaining = ?, quantity_allocated = ?
       WHERE id = ?`,
      [toDbString(newRemaining), toDbString(newAllocated), layer.id]
    );

    // insert allocation record
    const [allocResult] = await conn.execute(
      `INSERT INTO inventory_cost_allocations
       (cost_layer_id, movement_type, movement_id,
        quantity_allocated, unit_cost, total_cost, journal_entry_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        layer.id, opts.movementType, opts.movementId,
        toDbString(allocQty), toDbString(layerUnitCost), toDbString(allocCost),
        opts.journalEntryId || null,
      ]
    );

    totalAllocatedCost = totalAllocatedCost.plus(allocCost);
    remainingToAllocate = remainingToAllocate.minus(allocQty);
    layerIds.push(layer.id);
    allocationIds.push(allocResult.insertId);
  }

  if (remainingToAllocate.gt(0)) {
    throw Object.assign(
      new Error(`Insufficient cost layer quantity for lot ${opts.lotId}. Short by ${toDbString(remainingToAllocate)}`),
      { statusCode: 422, code: 'INVENTORY_COST_MISSING' }
    );
  }

  totalAllocatedCost = moneyRound(totalAllocatedCost);

  // when several layers are drawn their rates differ, so the issue rate is the weighted
  // average of what was actually consumed
  const weightedUnitCost = qty.isZero() ? money('0') : moneyRound(totalAllocatedCost.dividedBy(qty));

  return {
    costLayerId: layerIds[0] || 0,
    unitCost: toDbString(weightedUnitCost),
    totalCost: toDbString(totalAllocatedCost),
    allocationIds,
    layerIds,
  };
}

// link every allocation of one issue to its journal; a multi-layer issue must not leave
// earlier allocations unlinked
export async function linkAllocationsToJournal(
  conn: any,
  allocationIds: number[],
  journalEntryId: number
): Promise<void> {
  for (const id of allocationIds) {
    await conn.execute('UPDATE inventory_cost_allocations SET journal_entry_id = ? WHERE id = ?', [journalEntryId, id]);
  }
}

// get cost layer for a lot (for QC release journal amount lookup)
export async function getCostLayerForLot(conn: any, lotId: number): Promise<{ unitCost: string; totalCost: string; costLayerId: number } | null> {
  const [rows] = await conn.execute(
    `SELECT id, unit_cost, total_cost, quantity_remaining
     FROM inventory_cost_layers
     WHERE lot_id = ?
     ORDER BY id ASC
     LIMIT 1`,
    [lotId]
  );

  if (!rows || rows.length === 0) return null;

  const layer = rows[0];
  return {
    costLayerId: layer.id,
    unitCost: String(layer.unit_cost),
    totalCost: String(layer.total_cost),
  };
}

// ensure batch cost sheet exists for a WO, add material cost
export async function addMaterialCostToBatch(conn: any, opts: {
  woId: number;
  batchNumber: string | null;
  materialCost: string; // decimal string to add
  fgProductId: number;
}): Promise<void> {
  const addCost = money(opts.materialCost);
  const batchKey = opts.batchNumber || '';

  // try to find existing sheet
  const [existing] = await conn.execute(
    `SELECT id, material_cost, total_cost, version
     FROM batch_cost_sheets
     WHERE wo_id = ? AND COALESCE(batch_number, '') = ?
     FOR UPDATE`,
    [opts.woId, batchKey]
  );

  if (existing && existing.length > 0) {
    const sheet = existing[0];
    const newMaterialCost = moneyRound(money(String(sheet.material_cost)).plus(addCost));
    const newTotalCost = moneyRound(
      newMaterialCost
        .plus(money(String(sheet.direct_labor || 0)))
        .plus(money(String(sheet.overhead_absorbed || 0)))
        .plus(money(String(sheet.outside_processing || 0)))
    );

    await conn.execute(
      `UPDATE batch_cost_sheets
       SET material_cost = ?, total_cost = ?, version = version + 1, updated_at = NOW()
       WHERE id = ?`,
      [toDbString(newMaterialCost), toDbString(newTotalCost), sheet.id]
    );
  } else {
    // create new sheet
    await conn.execute(
      `INSERT INTO batch_cost_sheets
       (wo_id, batch_number, fg_product_id, material_cost, total_cost, cost_status)
       VALUES (?, ?, ?, ?, ?, 'OPEN')`,
      [opts.woId, opts.batchNumber || null, opts.fgProductId, toDbString(addCost), toDbString(addCost)]
    );
  }
}

// compute provisional FG unit cost from batch cost sheet
// called when FG is received to determine cost layer unit_cost
export async function computeProvisionalFgCost(conn: any, woId: number): Promise<{
  unitCost: string;
  totalCost: string;
  outputQty: string;
  sheetId: number;
}> {
  // sum all batch cost sheets for this WO
  const [sheets] = await conn.execute(
    `SELECT id, material_cost, direct_labor, overhead_absorbed, outside_processing,
            total_cost, accepted_output_qty
     FROM batch_cost_sheets
     WHERE wo_id = ?
     FOR UPDATE`,
    [woId]
  );

  let totalMaterial = money('0');
  let totalLabor = money('0');
  let totalOverhead = money('0');
  let totalOutside = money('0');
  let sheetId = 0;

  for (const s of (sheets || [])) {
    totalMaterial = totalMaterial.plus(money(String(s.material_cost || 0)));
    totalLabor = totalLabor.plus(money(String(s.direct_labor || 0)));
    totalOverhead = totalOverhead.plus(money(String(s.overhead_absorbed || 0)));
    totalOutside = totalOutside.plus(money(String(s.outside_processing || 0)));
    sheetId = s.id;
  }

  const totalCost = moneyRound(totalMaterial.plus(totalLabor).plus(totalOverhead).plus(totalOutside));

  // get accepted output from wo_results
  const [yieldRows] = await conn.execute(
    `SELECT COALESCE(SUM(output_quantity), 0) as total_output FROM wo_results WHERE wo_id = ?`,
    [woId]
  );
  const outputQty = money(String(yieldRows[0]?.total_output || 0));

  let unitCost = money('0');
  if (outputQty.gt(0)) {
    unitCost = moneyRound(totalCost.div(outputQty));
  }

  return {
    unitCost: toDbString(unitCost),
    totalCost: toDbString(totalCost),
    outputQty: toDbString(outputQty),
    sheetId,
  };
}

// update batch cost sheet with FG lot reference and output quantity
export async function updateBatchSheetForFgReceipt(conn: any, opts: {
  woId: number;
  batchNumber: string | null;
  fgLotId: number;
  outputQty: string;
  provisionalUnitCost: string;
}): Promise<void> {
  const batchKey = opts.batchNumber || '';

  // The sheet is owned by the work order and accumulates cost before any finished-goods
  // batch exists, so it is keyed '' during production. On the first FG receipt the batch
  // is stamped onto that sheet; later receipts of the same batch update it directly.
  const [target] = await conn.execute(
    `SELECT id FROM batch_cost_sheets WHERE wo_id = ? AND batch_number = ? FOR UPDATE`,
    [opts.woId, batchKey]
  );

  let sheetId: number | null = (target as any[])[0]?.id ?? null;

  if (sheetId === null && batchKey !== '') {
    const [unbatched] = await conn.execute(
      `SELECT id FROM batch_cost_sheets WHERE wo_id = ? AND batch_number = '' FOR UPDATE`,
      [opts.woId]
    );
    sheetId = (unbatched as any[])[0]?.id ?? null;
    if (sheetId !== null) {
      await conn.execute('UPDATE batch_cost_sheets SET batch_number = ? WHERE id = ?', [batchKey, sheetId]);
    }
  }

  if (sheetId === null) {
    throw Object.assign(
      new Error(`No batch cost sheet for WO ${opts.woId}; finished goods cannot be costed`),
      { statusCode: 422, code: 'BATCH_COST_SHEET_MISSING' }
    );
  }

  const [result] = await conn.execute(
    `UPDATE batch_cost_sheets
     SET fg_lot_id = ?,
         accepted_output_qty = accepted_output_qty + ?,
         provisional_unit_cost = ?,
         cost_status = 'PROVISIONAL',
         version = version + 1,
         updated_at = NOW()
     WHERE id = ?`,
    [opts.fgLotId, opts.outputQty, opts.provisionalUnitCost, sheetId]
  );

  // a silent zero-row update would leave finished goods with no accumulated cost
  if (!(result as any).affectedRows) {
    throw Object.assign(
      new Error(`Batch cost sheet ${sheetId} for WO ${opts.woId} was not updated`),
      { statusCode: 409, code: 'BATCH_COST_SHEET_CONFLICT' }
    );
  }
}

export interface CostRestoreResult {
  costLayerId: number;
  allocationId: number;
  unitCost: string;
  totalCost: string;
}

/**
 * Give quantity back to the cost layer an issue consumed, and record a compensating
 * allocation. Without this a return raises physical stock while valuated stock stays low.
 */
export async function restoreCostToLayer(conn: any, opts: {
  costLayerId: number;
  quantity: string;
  movementType: 'return';
  movementId: number;
}): Promise<CostRestoreResult> {
  const qty = money(opts.quantity);

  const [layers] = await conn.execute(
    `SELECT id, unit_cost, quantity_remaining, quantity_allocated
     FROM inventory_cost_layers WHERE id = ? FOR UPDATE`,
    [opts.costLayerId]
  );
  const layer = (layers as any[])[0];
  if (!layer) {
    throw Object.assign(
      new Error(`Cost layer ${opts.costLayerId} not found; the return cannot be valued`),
      { statusCode: 422, code: 'INVENTORY_COST_MISSING' }
    );
  }

  const allocated = money(String(layer.quantity_allocated || 0));
  if (qty.greaterThan(allocated)) {
    throw Object.assign(
      new Error(
        `Return of ${toDbString(qty)} exceeds the ${toDbString(allocated)} allocated from cost layer ${layer.id}`
      ),
      { statusCode: 409, code: 'COST_ALLOCATION_EXCEEDED' }
    );
  }

  const unitCost = money(String(layer.unit_cost));
  const totalCost = moneyRound(unitCost.times(qty));

  await conn.execute(
    `UPDATE inventory_cost_layers
     SET quantity_remaining = ?, quantity_allocated = ?
     WHERE id = ?`,
    [
      toDbString(moneyRound(money(String(layer.quantity_remaining)).plus(qty))),
      toDbString(moneyRound(allocated.minus(qty))),
      layer.id,
    ]
  );

  // negative quantity so the allocation rows still sum to the net quantity consumed
  const [allocResult] = await conn.execute(
    `INSERT INTO inventory_cost_allocations
     (cost_layer_id, movement_type, movement_id, quantity_allocated, unit_cost, total_cost)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [layer.id, opts.movementType, opts.movementId, toDbString(qty.negated()), toDbString(unitCost), toDbString(totalCost.negated())]
  );

  return {
    costLayerId: layer.id,
    allocationId: allocResult.insertId,
    unitCost: toDbString(unitCost),
    totalCost: toDbString(totalCost),
  };
}

/**
 * Reduce accumulated material cost on a work order's cost sheet when material is returned.
 */
export async function reduceMaterialCostOnBatch(conn: any, opts: {
  woId: number;
  materialCost: string;
}): Promise<void> {
  const [rows] = await conn.execute(
    `SELECT id, material_cost, direct_labor, overhead_absorbed, outside_processing
     FROM batch_cost_sheets WHERE wo_id = ? ORDER BY id ASC LIMIT 1 FOR UPDATE`,
    [opts.woId]
  );
  const sheet = (rows as any[])[0];
  if (!sheet) return;

  const newMaterial = moneyRound(money(String(sheet.material_cost)).minus(money(opts.materialCost)));
  const newTotal = moneyRound(
    newMaterial
      .plus(money(String(sheet.direct_labor || 0)))
      .plus(money(String(sheet.overhead_absorbed || 0)))
      .plus(money(String(sheet.outside_processing || 0)))
  );

  await conn.execute(
    `UPDATE batch_cost_sheets
     SET material_cost = ?, total_cost = ?, version = version + 1, updated_at = NOW()
     WHERE id = ?`,
    [toDbString(newMaterial), toDbString(newTotal), sheet.id]
  );
}
