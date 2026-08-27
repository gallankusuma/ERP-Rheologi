import { dbAll, dbGet, dbRun, dbTransaction } from '../config/database';
import { autoCreateFpa } from './qc.service';
import { createLot, resolveQcPolicy } from './lot.service';
import { postSystemJournal, postStatisticalEvent, JournalLineInput } from './accounting-posting.service';
import { resolveValuation } from './valuation-policy.service';
import { resolveAccountByRole } from './account-role.service';
import {
  allocateCostFromLayer, linkAllocationsToJournal, restoreCostToLayer, reduceMaterialCostOnBatch,
  addMaterialCostToBatch, computeProvisionalFgCost,
  createCostLayer, linkCostLayerToJournal, updateBatchSheetForFgReceipt,
} from './inventory-costing.service';
import { toDbString, money, moneyRound } from '../lib/decimal';
import { computePayloadHash, checkIdempotency, storeIdempotency } from './accounting-posting.service';

// Production commands used to throw bare Errors, so the routes had to guess a status by
// matching words in the message — a rename of an error string silently changed an HTTP code.
// These carry their own status and a stable code, like every other domain in this system.
export type ProductionErrorCode =
  | 'WO_NOT_FOUND'
  | 'WO_MATERIAL_NOT_FOUND'
  | 'INVALID_WO_STATUS'
  | 'INVALID_INPUT'
  | 'LOT_REQUIRED'
  | 'LOT_NOT_AVAILABLE'
  | 'INSUFFICIENT_STOCK'
  | 'OVER_ISSUE'
  | 'OVER_RETURN'
  | 'ISSUE_NOT_FOUND'
  | 'ISSUE_AMBIGUOUS'
  | 'QC_NOT_PASSED'
  | 'NO_QC_CHECKPOINTS'
  | 'YIELD_EXCEEDED'
  | 'WO_TERMINAL'
  | 'INVALID_ISSUE_LINEAGE'
  | 'NOTHING_TO_RETURN'
  | 'MISSING_LOT_LINEAGE';

const PRODUCTION_STATUS: Record<ProductionErrorCode, number> = {
  WO_NOT_FOUND: 404,
  WO_MATERIAL_NOT_FOUND: 404,
  INVALID_WO_STATUS: 409,
  INVALID_INPUT: 422,
  LOT_REQUIRED: 422,
  LOT_NOT_AVAILABLE: 409,
  INSUFFICIENT_STOCK: 409,
  OVER_ISSUE: 409,
  OVER_RETURN: 409,
  ISSUE_NOT_FOUND: 404,
  ISSUE_AMBIGUOUS: 422,
  QC_NOT_PASSED: 409,
  NO_QC_CHECKPOINTS: 409,
  YIELD_EXCEEDED: 409,
  WO_TERMINAL: 409,
  INVALID_ISSUE_LINEAGE: 422,
  NOTHING_TO_RETURN: 422,
  MISSING_LOT_LINEAGE: 422,
};

export class ProductionError extends Error {
  public readonly code: ProductionErrorCode;
  public readonly httpStatus: number;
  public readonly data?: Record<string, unknown>;

  constructor(code: ProductionErrorCode, message: string, data?: Record<string, unknown>) {
    super(message);
    this.name = 'ProductionError';
    this.code = code;
    this.httpStatus = PRODUCTION_STATUS[code];
    this.data = data;
  }
}

// WO statuses that allow material issue
const ISSUABLE_STATUSES = ['released', 'in_progress', 'on_hold'];

interface IssueMaterialResult {
  success: boolean;
  message: string;
  issue_id?: number;
  journal_id?: number;
  replay?: boolean;
  [key: string]: any;
}

interface FgReceiptResult {
  success: boolean;
  message: string;
  replay?: boolean;
  [key: string]: any;
}

/**
 * Issue material to a Work Order.
 * Transaction + row lock on wo_materials + inventory_stocks.
 * Guards: over-issue, insufficient stock, WO status.
 */
export async function issueWoMaterial(opts: {
  woMaterialId: number;
  quantity: number;
  warehouseId: number;
  lotId: number;
  userId: number | null;
  idempotencyKey: string;
}): Promise<IssueMaterialResult> {
  const { woMaterialId, quantity, warehouseId, lotId, userId, idempotencyKey } = opts;

  if (!woMaterialId || !Number.isFinite(quantity) || quantity <= 0) {
    throw new ProductionError('INVALID_INPUT', 'wo_material_id and a positive quantity are required');
  }
  if (!warehouseId) {
    throw new ProductionError('INVALID_INPUT', 'warehouse_id is required for material issue');
  }
  if (!lotId) {
    throw new ProductionError('LOT_REQUIRED', 'lot_id is required for material issue');
  }
  if (!idempotencyKey) {
    throw new ProductionError('INVALID_INPUT', 'idempotency_key is required for material issue');
  }

  // The key alone used to be the whole contract: a second call with the same key returned
  // "Material issued successfully" without doing anything and without saying it had not. Reused
  // with a different quantity or lot, it still said success. The stored outcome carries a hash
  // of what was asked, so a repeat of the same request replays the original answer and a
  // different one under the same key is refused as IDEMPOTENCY_MISMATCH.
  const payloadHash = computePayloadHash({ woMaterialId, quantity, warehouseId, lotId });

  return dbTransaction(async (conn) => {
    const idem = await checkIdempotency(conn, 'WO_MATERIAL_ISSUE', idempotencyKey, payloadHash);
    if (idem.replay) return { ...idem.outcome!.body, replay: true };

    // lock order: WO -> WO material -> inventory lot/balance
    // 1. lock WO first
    const [matPeek] = await conn.execute('SELECT wo_id FROM wo_materials WHERE id = ?', [woMaterialId]);
    const woId = (matPeek as any[])[0]?.wo_id;
    if (!woId) throw new ProductionError('WO_MATERIAL_NOT_FOUND', 'WO material not found');

    const [woRows] = await conn.execute('SELECT status FROM work_orders WHERE id = ? FOR UPDATE', [woId]);
    const woStatus = (woRows as any[])[0]?.status?.toLowerCase();
    if (!ISSUABLE_STATUSES.includes(woStatus)) {
      throw new ProductionError('INVALID_WO_STATUS', `Cannot issue material for WO with status '${(woRows as any[])[0]?.status}'. WO must be RELEASED, IN_PROGRESS, or ON_HOLD.`);
    }

    // 2. lock WO material
    const [matRows] = await conn.execute(
      'SELECT * FROM wo_materials WHERE id = ? FOR UPDATE', [woMaterialId]
    );
    const mat = (matRows as any[])[0];
    if (!mat) throw new ProductionError('WO_MATERIAL_NOT_FOUND', 'WO material not found');

    const alreadyIssued = Number(mat.quantity_issued) || 0;
    const requiredQty = Number(mat.quantity_required) || 0;
    const newIssued = alreadyIssued + Number(quantity);
    if (newIssued > requiredQty) {
      throw new ProductionError('OVER_ISSUE', `Issue quantity (${quantity}) would exceed required quantity (${requiredQty}). Already issued: ${alreadyIssued}`);
    }

    // 3. lock exact lot in inventory
    const [lotRows] = await conn.execute(
      "SELECT * FROM inventory_stocks WHERE lot_id = ? AND warehouse_id = ? AND product_id = ? AND status = 'available' FOR UPDATE",
      [lotId, warehouseId, mat.product_id]
    );
    const stock = (lotRows as any[])[0];
    if (!stock) {
      throw new ProductionError('LOT_NOT_AVAILABLE', `Lot ${lotId} not found as available stock for product ${mat.product_id} in warehouse ${warehouseId}`);
    }
    const currentQty = Number(stock.quantity) || 0;

    if (currentQty < quantity) {
      throw new ProductionError('INSUFFICIENT_STOCK', `Insufficient stock. Available: ${currentQty}, Requested: ${quantity}`);
    }

    // 4. update WO material issued quantity
    await conn.execute(
      `UPDATE wo_materials SET quantity_issued=?, warehouse_id=?, issued_at=CURRENT_TIMESTAMP, issued_by=? WHERE id=?`,
      [newIssued, warehouseId, userId, woMaterialId]
    );

    // 5. deduct inventory stock
    await conn.execute(
      `UPDATE inventory_stocks SET quantity = quantity - ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?`,
      [quantity, stock.id]
    );

    // 6. record stock movement with lot reference
    await conn.execute(
      `INSERT INTO stock_movements (warehouse_id, product_id, batch_number, movement_type, quantity, reference_type, reference_id, lot_id, notes, created_by)
       VALUES (?, ?, ?, 'out', ?, 'wo_material', ?, ?, 'Material issued to WO', ?)`,
      [warehouseId, mat.product_id, stock.batch_number || null, quantity, woMaterialId, lotId, userId]
    );

    // 7. insert issue event with idempotency key
    const [issueResult] = await conn.execute(
      `INSERT INTO wo_material_issues (wo_material_id, wo_id, warehouse_id, product_id, quantity, batch_number, lot_id, issued_by, idempotency_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [woMaterialId, woId, warehouseId, mat.product_id, quantity, stock.batch_number || null, lotId, userId, idempotencyKey]
    );
    const issueId = issueResult.insertId;

    // phase 4: allocate cost from exact lot layer
    const costAlloc = await allocateCostFromLayer(conn, {
      lotId,
      productId: mat.product_id,
      quantity: String(quantity),
      movementType: 'wo_material_issue',
      movementId: issueId,
    });

    // update issue record with cost
    await conn.execute(
      'UPDATE wo_material_issues SET unit_cost = ?, total_cost = ?, cost_layer_id = ? WHERE id = ?',
      [costAlloc.unitCost, costAlloc.totalCost, costAlloc.costLayerId, issueId]
    );

    // accumulate material cost on the work order's cost sheet. The sheet is keyed by the
    // WO and stays unbatched until an FG receipt stamps the finished-goods batch onto it;
    // keying it by the raw material's batch made the RM lot the identity of the FG sheet.
    const [woProductRow] = await conn.execute('SELECT product_id FROM work_orders WHERE id = ?', [woId]);
    const fgProductId = (woProductRow as any[])[0]?.product_id;
    if (!fgProductId) throw new ProductionError('WO_NOT_FOUND', `WO ${woId} has no product; cannot cost the batch`);

    await addMaterialCostToBatch(conn, {
      woId,
      batchNumber: null,
      materialCost: costAlloc.totalCost,
      fgProductId,
    });

    // phase 4: GL journal — Dr WIP, Cr RM Available
    const wipAccount = await resolveAccountByRole(conn, 'INVENTORY_WIP', { warehouseId });
    const rmAccount = await resolveAccountByRole(conn, 'INVENTORY_RM_AVAILABLE', { warehouseId });

    // get WO number for description
    const [woNumRow] = await conn.execute('SELECT wo_number FROM work_orders WHERE id = ?', [woId]);
    const woNumber = woNumRow?.[0]?.wo_number || `WO-${woId}`;

    const glLines: JournalLineInput[] = [
      {
        accountId: wipAccount.accountId,
        description: `Material issue to ${woNumber} - lot ${lotId} (${quantity} units)`,
        debit: costAlloc.totalCost,
        credit: '0',
        productId: mat.product_id,
        warehouseId,
        lotId,
      },
      {
        accountId: rmAccount.accountId,
        description: `Material issue to ${woNumber} - RM consumed`,
        debit: '0',
        credit: costAlloc.totalCost,
        productId: mat.product_id,
        warehouseId,
        lotId,
      },
    ];

    const glResult = await postSystemJournal(conn, {
      sourceModule: 'PRODUCTION',
      sourceType: 'wo_material_issue',
      sourceId: issueId,
      sourceEventType: 'MATERIAL_ISSUED',
      businessDate: new Date().toISOString().slice(0, 10),
      description: `Material issue to ${woNumber}`,
      lines: glLines,
      idempotencyKey,
      userId: userId || 0,
    });

    // link allocation and issue to journal
    await linkAllocationsToJournal(conn, costAlloc.allocationIds, glResult.journal_id);
    await conn.execute(
      'UPDATE wo_material_issues SET journal_entry_id = ? WHERE id = ?',
      [glResult.journal_id, issueId]
    );

    const outcome = {
      success: true,
      issue_id: issueId,
      journal_id: glResult.journal_id,
      lot_id: lotId,
      quantity: String(quantity),
      unit_cost: costAlloc.unitCost,
      total_cost: costAlloc.totalCost,
      message: 'Material issued successfully',
    };
    await storeIdempotency(
      conn, 'WO_MATERIAL_ISSUE', idempotencyKey, payloadHash, 201, outcome, issueId, glResult.journal_id
    );
    return outcome;
  });
}

interface ReturnMaterialResult {
  success: boolean;
  message: string;
  replay?: boolean;
  [key: string]: any;
}

/**
 * Return unused material from production back to warehouse.
 * Guards: over-return, WO status.
 */
export async function returnWoMaterial(opts: {
  woMaterialId: number;
  quantity: number;
  warehouseId: number;
  originalIssueId?: number | null;
  notes?: string | null;
  reason?: string | null;
  userId: number | null;
  idempotencyKey?: string | null;
}): Promise<ReturnMaterialResult> {
  const { woMaterialId, quantity, warehouseId, originalIssueId, notes, reason, userId, idempotencyKey } = opts;

  if (!woMaterialId || !Number.isFinite(quantity) || quantity <= 0) {
    throw new ProductionError('INVALID_INPUT', 'wo_material_id and a positive quantity are required');
  }
  if (!warehouseId) {
    throw new ProductionError('INVALID_INPUT', 'warehouse_id is required for material return');
  }

  return dbTransaction(async (conn) => {
    // lock order: WO -> WO material -> original issue -> lot balance -> cost layer
    const [matPeek] = await conn.execute('SELECT wo_id FROM wo_materials WHERE id = ?', [woMaterialId]);
    const woId = (matPeek as any[])[0]?.wo_id;
    if (!woId) throw new ProductionError('WO_MATERIAL_NOT_FOUND', 'WO material not found');

    const [woRows] = await conn.execute('SELECT wo_number, status FROM work_orders WHERE id = ? FOR UPDATE', [woId]);
    const wo = (woRows as any[])[0];
    if (!wo) throw new ProductionError('WO_NOT_FOUND', 'Work order not found');
    const woStatus = String(wo.status || '').toLowerCase();
    if (['completed', 'closed', 'cancelled'].includes(woStatus)) {
      throw new ProductionError('WO_TERMINAL', `WO ${wo.wo_number} is ${woStatus}; material can no longer be returned`);
    }

    const [matRows] = await conn.execute('SELECT * FROM wo_materials WHERE id = ? FOR UPDATE', [woMaterialId]);
    const mat = (matRows as any[])[0];
    if (!mat) throw new ProductionError('WO_MATERIAL_NOT_FOUND', 'WO material not found');

    // a return compensates one specific issue: that is what carries the lot and the cost
    let issue: any;
    if (originalIssueId) {
      const [rows] = await conn.execute(
        'SELECT * FROM wo_material_issues WHERE id = ? AND wo_material_id = ? FOR UPDATE',
        [originalIssueId, woMaterialId]
      );
      issue = (rows as any[])[0];
      if (!issue) {
        throw new ProductionError('INVALID_ISSUE_LINEAGE', `Issue ${originalIssueId} does not belong to WO material ${woMaterialId}`);
      }
    } else {
      // no explicit issue: proceed only when exactly one issue still has returnable quantity,
      // so the lot and cost are unambiguous rather than "whichever was issued most recently"
      const [rows] = await conn.execute(
        `SELECT * FROM wo_material_issues
          WHERE wo_material_id = ? AND (quantity - COALESCE(returned_qty, 0)) > 0
          ORDER BY id ASC FOR UPDATE`,
        [woMaterialId]
      );
      const candidates = rows as any[];
      if (candidates.length === 0) {
        throw new ProductionError('NOTHING_TO_RETURN', 'No issued quantity remains to return for this WO material');
      }
      if (candidates.length > 1) {
        throw new ProductionError('ISSUE_AMBIGUOUS', `WO material ${woMaterialId} has ${candidates.length} issues with returnable quantity; original_issue_id is required to identify the lot and cost being compensated`, { candidateIssueIds: candidates.map((c: any) => c.id) });
      }
      issue = candidates[0];
    }

    const issuedQty = money(String(issue.quantity));
    const priorReturns = money(String(issue.returned_qty || 0));
    const returnQty = money(String(quantity));
    const returnable = issuedQty.minus(priorReturns);

    if (returnQty.greaterThan(returnable)) {
      throw new ProductionError('OVER_RETURN', `Return of ${toDbString(returnQty)} exceeds the ${toDbString(returnable)} still returnable on issue ${issue.id}`);
    }

    const returnKey = idempotencyKey || `mat-return-${issue.id}-${toDbString(returnQty)}`;

    // The key alone was the whole check, so a caller who reused an explicit key with a
    // different quantity was told the return had succeeded while nothing moved. The hash covers
    // what was asked, so the same request replays its original answer and a different one under
    // the same key is refused rather than waved through.
    const returnPayloadHash = computePayloadHash({
      woMaterialId, quantity, warehouseId, originalIssueId: issue.id,
    });
    const returnIdem = await checkIdempotency(conn, 'WO_MATERIAL_RETURN', returnKey, returnPayloadHash);
    if (returnIdem.replay) return { ...returnIdem.outcome!.body, replay: true };

    const lotId = issue.lot_id;
    if (!lotId) {
      throw new ProductionError('MISSING_LOT_LINEAGE', `Issue ${issue.id} has no lot; the exact lot to return to cannot be determined`);
    }

    // return to the exact lot the material left, not to any available row for the product
    const [lotStockRows] = await conn.execute(
      `SELECT id FROM inventory_stocks
        WHERE lot_id = ? AND warehouse_id = ? AND product_id = ? AND status = 'available'
        FOR UPDATE`,
      [lotId, warehouseId, mat.product_id]
    );
    const lotStock = (lotStockRows as any[])[0];

    if (lotStock) {
      await conn.execute(
        'UPDATE inventory_stocks SET quantity = quantity + ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?',
        [quantity, lotStock.id]
      );
    } else {
      await conn.execute(
        `INSERT INTO inventory_stocks (product_id, warehouse_id, quantity, status, lot_id, batch_number, last_updated)
         VALUES (?, ?, ?, 'available', ?, ?, CURRENT_TIMESTAMP)`,
        [mat.product_id, warehouseId, quantity, lotId, issue.batch_number || null]
      );
    }

    await conn.execute('UPDATE wo_materials SET quantity_issued = quantity_issued - ? WHERE id = ?', [
      quantity,
      woMaterialId,
    ]);

    const newReturned = moneyRound(priorReturns.plus(returnQty));
    const returnStatus = newReturned.greaterThanOrEqualTo(issuedQty) ? 'RETURNED' : 'PARTIALLY_RETURNED';
    await conn.execute('UPDATE wo_material_issues SET returned_qty = ?, return_status = ? WHERE id = ?', [
      toDbString(newReturned),
      returnStatus,
      issue.id,
    ]);

    const [returnMovement] = await conn.execute(
      `INSERT INTO stock_movements (warehouse_id, product_id, batch_number, movement_type, quantity, reference_type, reference_id, lot_id, notes, created_by)
       VALUES (?, ?, ?, 'in', ?, 'material_return', ?, ?, ?, ?)`,
      [
        warehouseId, mat.product_id, issue.batch_number || null, quantity,
        issue.id, lotId, notes || reason || 'Material returned from production', userId,
      ]
    );

    // give the quantity back to the layer it was consumed from, valued at that layer's rate
    const restored = await restoreCostToLayer(conn, {
      costLayerId: issue.cost_layer_id,
      quantity: toDbString(returnQty),
      movementType: 'return',
      movementId: returnMovement.insertId,
    });

    await reduceMaterialCostOnBatch(conn, { woId, materialCost: restored.totalCost });

    const returnBusinessDate = new Date().toISOString().slice(0, 10);
    const returnValuation = await resolveValuation(conn, {
      sourceEventType: 'MATERIAL_RETURNED',
      businessDate: returnBusinessDate,
      quantity: toDbString(returnQty),
      unitCost: restored.unitCost,
      context: { issueId: issue.id, lotId, woMaterialId, warehouseId },
    });

    let journalId: number | null = null;

    if (returnValuation.statistical) {
      await postStatisticalEvent(conn, {
        sourceModule: 'PRODUCTION',
        sourceType: 'material_return',
        sourceId: returnMovement.insertId,
        sourceEventType: 'MATERIAL_RETURNED',
        businessDate: returnBusinessDate,
        description: `Material return from ${wo.wo_number} - zero-value`,
        postingProfileId: returnValuation.profileId,
        idempotencyKey: returnKey,
        userId: userId || 0,
      });
    } else {
      const rmAccount = await resolveAccountByRole(conn, 'INVENTORY_RM_AVAILABLE', { warehouseId });
      const wipAccount = await resolveAccountByRole(conn, 'INVENTORY_WIP', { warehouseId });

      const glLines: JournalLineInput[] = [
        {
          accountId: rmAccount.accountId,
          description: `Material return from ${wo.wo_number} lot ${lotId} (${quantity} units)`,
          debit: returnValuation.amount,
          credit: '0',
          productId: mat.product_id,
          warehouseId,
          lotId,
        },
        {
          accountId: wipAccount.accountId,
          description: `Material return from ${wo.wo_number} - WIP reduced`,
          debit: '0',
          credit: returnValuation.amount,
          productId: mat.product_id,
          warehouseId,
          lotId,
        },
      ];

      const glResult = await postSystemJournal(conn, {
        sourceModule: 'PRODUCTION',
        sourceType: 'material_return',
        sourceId: returnMovement.insertId,
        sourceEventType: 'MATERIAL_RETURNED',
        businessDate: returnBusinessDate,
        description: `Material return from ${wo.wo_number}`,
        lines: glLines,
        idempotencyKey: returnKey,
        userId: userId || 0,
      });
      journalId = glResult.journal_id;
      await linkAllocationsToJournal(conn, [restored.allocationId], journalId as number);
    }

    await conn.execute(
      `INSERT INTO wo_material_returns
       (original_issue_id, wo_material_id, wo_id, product_id, warehouse_id, lot_id,
        quantity, unit_cost, total_cost, cost_layer_id, cost_allocation_id,
        movement_id, journal_entry_id, reason, idempotency_key, returned_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        issue.id, woMaterialId, woId, mat.product_id, warehouseId, lotId,
        toDbString(returnQty), restored.unitCost, restored.totalCost,
        restored.costLayerId, restored.allocationId,
        returnMovement.insertId, journalId, reason || notes || null, returnKey, userId,
      ]
    );

    const outcome = {
      success: true,
      original_issue_id: issue.id,
      lot_id: lotId,
      quantity: toDbString(returnQty),
      unit_cost: restored.unitCost,
      total_cost: restored.totalCost,
      journal_id: journalId,
      message: 'Material returned to warehouse successfully',
    };
    await storeIdempotency(
      conn, 'WO_MATERIAL_RETURN', returnKey, returnPayloadHash, 201, outcome, issue.id, journalId
    );
    return outcome;
  });
}

/**
 * Post Finished Goods receipt from a Work Order.
 * Transaction + row lock on work_orders + inventory_stocks.
 * Guards: WO status, QC gate (mandatory checkpoints), yield ceiling,
 *         over-receipt, idempotency key.
 */
export async function postFinishedGoods(opts: {
  woId: number;
  warehouseId: number;
  quantity: number;
  batchNumber?: string | null;
  idempotencyKey?: string | null;
  userId: number | null;
}): Promise<FgReceiptResult> {
  const { woId, warehouseId, quantity, batchNumber, idempotencyKey, userId } = opts;

  if (!woId || !warehouseId || !Number.isFinite(quantity) || quantity <= 0) {
    throw new ProductionError('INVALID_INPUT', 'wo_id, warehouse_id, and a positive quantity are required');
  }

  if (!idempotencyKey) {
    throw new ProductionError('INVALID_INPUT', 'idempotency_key is required for FG receipt');
  }
  // The old check searched stock_movements for the key with no scope at all, so a key used by
  // a material issue could collide with an FG receipt, and a repeat under the same key with a
  // different quantity returned success having done nothing.
  const payloadHash = computePayloadHash({ woId, warehouseId, quantity, batchNumber: batchNumber || null });

  return dbTransaction(async (conn) => {
    const idem = await checkIdempotency(conn, 'FG_RECEIPT', idempotencyKey, payloadHash);
    if (idem.replay) return { ...idem.outcome!.body, replay: true };

    // 1. lock and validate Work Order
    const [woRows] = await conn.execute(
      `SELECT w.*, p.name AS product_name FROM work_orders w JOIN products p ON p.id = w.product_id WHERE w.id = ? FOR UPDATE`, [woId]
    );
    const wo = (woRows as any[])[0];
    if (!wo) throw new ProductionError('WO_NOT_FOUND', 'Work order not found');

    const allowedStatuses = ['in_progress', 'completed', 'IN_PROGRESS', 'COMPLETED'];
    if (!allowedStatuses.includes(wo.status)) {
      throw new ProductionError('INVALID_WO_STATUS', `Cannot receive FG for WO with status '${wo.status}'. WO must be in_progress or completed.`);
    }


    // 3. QC gate — mandatory checkpoints must all have status exactly 'passed'
    // NULL or any non-'passed' value blocks FG receipt
    const [qcRows] = await conn.execute(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN is_mandatory = 1 AND (status IS NULL OR LOWER(status) != 'passed') THEN 1 ELSE 0 END) AS pending_mandatory
       FROM wo_qc_checkpoints WHERE wo_id = ?`,
      [woId]
    );
    const qcTotal = Number((qcRows as any[])[0]?.total || 0);
    const qcPendingMandatory = Number((qcRows as any[])[0]?.pending_mandatory || 0);
    if (qcTotal === 0) {
      throw new ProductionError('NO_QC_CHECKPOINTS', 'Cannot receive FG: this WO has no QC checkpoints. Generate QC checkpoints and complete inspection first.');
    }
    if (qcPendingMandatory > 0) {
      throw new ProductionError('QC_NOT_PASSED', `Cannot receive FG: ${qcPendingMandatory} mandatory QC checkpoint(s) not passed. Complete QC inspection first.`);
    }

    // 4. yield ceiling — FG receipt cannot exceed actual accepted output
    const [yieldRows] = await conn.execute(
      `SELECT COALESCE(SUM(output_quantity), 0) as total_output FROM wo_results WHERE wo_id = ?`,
      [woId]
    );
    const maxReceivable = Number((yieldRows as any[])[0]?.total_output || 0);
    if (maxReceivable === 0) {
      throw new ProductionError('YIELD_EXCEEDED', 'Cannot receive FG: no yield recorded for this WO. Record actual output first.');
    }

    const [existingReceipts] = await conn.execute(
      `SELECT COALESCE(SUM(quantity), 0) as total_received FROM stock_movements 
       WHERE reference_type = 'fg_receipt' AND reference_id = ? AND movement_type = 'in'`,
      [woId]
    );
    const alreadyReceived = Number((existingReceipts as any[])[0]?.total_received || 0);
    if (alreadyReceived + quantity > maxReceivable) {
      throw new ProductionError('YIELD_EXCEEDED', `Total receipt (${alreadyReceived + quantity}) exceeds actual accepted output (${maxReceivable}). Already received: ${alreadyReceived}`);
    }

    // 5. create FG receipt event and canonical lot
    const [receiptEvent] = await conn.execute(
      `INSERT INTO stock_movements (warehouse_id, product_id, batch_number, movement_type, quantity, reference_type, reference_id, notes, created_by, idempotency_key)
       VALUES (?, ?, ?, 'in', ?, 'fg_receipt', ?, ?, ?, ?)`,
      [warehouseId, wo.product_id, batchNumber || null, quantity, woId,
       `FG receipt from ${wo.wo_number || 'WO-' + woId}`, userId, idempotencyKey || null]
    );
    const receiptEventId = receiptEvent.insertId;

    // resolve QC policy
    const qcPolicy = await resolveQcPolicy(wo.product_id, 'FG', conn);

    // create canonical lot for this receipt event
    const { lotId, lotNumber } = await createLot({
      productId: wo.product_id,
      sourceType: 'fg_receipt',
      sourceDocumentId: woId,
      sourceLineId: receiptEventId,
      batchNumber: batchNumber || null,
      qcPolicy,
      conn
    });

    // update movement with lot_id
    await conn.execute('UPDATE stock_movements SET lot_id = ? WHERE id = ?', [lotId, receiptEventId]);

    // phase 4: compute provisional FG cost from batch cost sheet
    const fgCostData = await computeProvisionalFgCost(conn, woId);
    const fgUnitCost = fgCostData.unitCost;
    const fgTotalCost = toDbString(moneyRound(money(fgUnitCost).times(money(String(quantity)))));

    if (qcPolicy === 'NOT_REQUIRED') {
      // no QC needed: create available stock directly
      await conn.execute(
        "INSERT INTO inventory_stocks (warehouse_id, product_id, quantity, status, lot_id, batch_number, source_type, source_id) VALUES (?, ?, ?, 'available', ?, ?, 'fg_receipt', ?)",
        [warehouseId, wo.product_id, quantity, lotId, batchNumber || null, woId]
      );
    } else {
      // REQUIRED: create qc_hold keyed to lot
      await conn.execute(
        "INSERT INTO inventory_stocks (warehouse_id, product_id, quantity, status, lot_id, batch_number, source_type, source_id) VALUES (?, ?, ?, 'qc_hold', ?, ?, 'fg_receipt', ?)",
        [warehouseId, wo.product_id, quantity, lotId, batchNumber || null, woId]
      );
    }

    // phase 4: create FG cost layer (PROVISIONAL until WO close)
    const fgCostLayerId = await createCostLayer(conn, {
      lotId,
      productId: wo.product_id,
      warehouseId,
      quantity: String(quantity),
      unitCost: fgUnitCost,
      sourceType: 'fg_receipt',
      sourceDocumentId: woId,
      sourceLineId: receiptEventId,
      costStatus: 'PROVISIONAL',
      createdBy: userId || 0,
    });

    // update batch cost sheet with FG lot reference
    await updateBatchSheetForFgReceipt(conn, {
      woId,
      batchNumber: batchNumber || null,
      fgLotId: lotId,
      outputQty: String(quantity),
      provisionalUnitCost: fgUnitCost,
    });

    // phase 4: GL is a mandatory participant — finished goods never enter stock without
    // an accounting record of what they are worth
    const fgBusinessDate = new Date().toISOString().slice(0, 10);
    const fgValuation = await resolveValuation(conn, {
      sourceEventType: 'FG_RECEIVED',
      businessDate: fgBusinessDate,
      quantity: String(quantity),
      unitCost: fgUnitCost,
      context: { woId, receiptEventId, productId: wo.product_id, lotId },
    });

    if (fgValuation.statistical) {
      await postStatisticalEvent(conn, {
        sourceModule: 'PRODUCTION',
        sourceType: 'fg_receipt',
        sourceId: woId,
        sourceLineId: receiptEventId,
        sourceEventType: 'FG_RECEIVED',
        businessDate: fgBusinessDate,
        description: `FG receipt from ${wo.wo_number || 'WO-' + woId} - zero-value output`,
        postingProfileId: fgValuation.profileId,
        idempotencyKey: idempotencyKey || `fg-receipt-${woId}-${receiptEventId}`,
        userId: userId || 0,
      });
    } else {
      const debitRole = qcPolicy === 'NOT_REQUIRED' ? 'INVENTORY_FG_AVAILABLE' : 'INVENTORY_FG_QC_HOLD';
      const debitAccount = await resolveAccountByRole(conn, debitRole, { warehouseId });
      const wipAccount = await resolveAccountByRole(conn, 'INVENTORY_WIP', { warehouseId });

      const glLines: JournalLineInput[] = [
        {
          accountId: debitAccount.accountId,
          description: `FG receipt from ${wo.wo_number || 'WO-' + woId} - lot ${lotId} (${quantity} units)`,
          debit: fgTotalCost,
          credit: '0',
          productId: wo.product_id,
          warehouseId,
          lotId,
        },
        {
          accountId: wipAccount.accountId,
          description: `FG receipt from ${wo.wo_number || 'WO-' + woId} - WIP relieved`,
          debit: '0',
          credit: fgTotalCost,
          productId: wo.product_id,
          warehouseId,
        },
      ];

      const glResult = await postSystemJournal(conn, {
        sourceModule: 'PRODUCTION',
        sourceType: 'fg_receipt',
        sourceId: woId,
        sourceLineId: receiptEventId,
        sourceEventType: 'FG_RECEIVED',
        businessDate: new Date().toISOString().slice(0, 10),
        description: `FG receipt from ${wo.wo_number || 'WO-' + woId}`,
        lines: glLines,
        idempotencyKey: idempotencyKey || `fg-receipt-${woId}-${receiptEventId}`,
        userId: userId || 0,
      });

      await linkCostLayerToJournal(conn, fgCostLayerId, glResult.journal_id);
    }

    // 7. update WO completed_quantity
    await conn.execute(
      'UPDATE work_orders SET completed_quantity = COALESCE(completed_quantity, 0) + ? WHERE id = ?',
      [quantity, woId]
    );

    // 8. attach this receipt's lot to its batch, and let the batch total itself up
    //
    // This used to look the batch number up and do nothing if a row already existed, so a
    // second partial receipt into the same batch left the header saying whatever the first
    // receipt happened to be. The header is now a projection of the lots attached to it: the
    // lot is linked, then the quantity is recomputed from what those lots actually received.
    if (batchNumber) {
      const [batchRows] = await conn.execute(
        // scoped by product: a batch number identifies a batch of a product, not one in the
        // universe, and two product lines may number theirs the same way
        'SELECT id FROM batches WHERE batch_number = ? AND product_id = ? FOR UPDATE',
        [batchNumber, wo.product_id]
      );
      let batchId = (batchRows as any[])[0]?.id;
      if (!batchId) {
        const [created] = await conn.execute(
          `INSERT INTO batches (batch_number, product_id, quantity, manufacture_date, status, warehouse_id)
           VALUES (?, ?, 0, CURDATE(), ?, ?)`,
          [batchNumber, wo.product_id, qcPolicy === 'NOT_REQUIRED' ? 'released' : 'pending_qc', warehouseId]
        );
        batchId = created.insertId;
      }

      await conn.execute('UPDATE inventory_lots SET batch_id = ? WHERE id = ?', [batchId, lotId]);

      // the header is the sum of its lots, so a second receipt raises it instead of being lost
      await conn.execute(
        `UPDATE batches b
            SET b.quantity = COALESCE((
                  SELECT SUM(cl.quantity_received)
                    FROM inventory_lots l
                    JOIN inventory_cost_layers cl ON cl.lot_id = l.id
                   WHERE l.batch_id = b.id
                ), 0)
          WHERE b.id = ?`,
        [batchId]
      );
    }

    // 9. auto-create FG QC FPA if REQUIRED and specs exist
    if (qcPolicy === 'REQUIRED') {
      const fpaResult = await autoCreateFpa({
        conn,
        type: 'FG',
        productId: wo.product_id,
        batchNo: batchNumber || null,
        woId: woId,
        referenceId: woId,
        referenceNumber: wo.wo_number || `WO-${woId}`,
        notes: `Auto-generated FG QC from WO ${wo.wo_number || woId} lot ${lotId}`,
        createdBy: userId,
        quantity: quantity,
        lotId: lotId
      });

      if (!fpaResult) {
        throw new ProductionError('QC_NOT_PASSED', `QC_SPEC_REQUIRED: product ${wo.product_id} has QC policy REQUIRED but no FG specifications. FG receipt rolled back.`);
      }
    }

    const outcome = {
      success: true,
      wo_id: woId,
      lot_id: lotId,
      quantity: String(quantity),
      batch_number: batchNumber || null,
      message: 'FG received into warehouse',
    };
    await storeIdempotency(conn, 'FG_RECEIPT', idempotencyKey, payloadHash, 201, outcome, receiptEventId ?? null, null);
    return outcome;
  });
}
