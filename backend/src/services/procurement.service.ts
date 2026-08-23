import { dbAll, dbGet, dbRun, dbTransaction } from '../config/database';
import { autoCreateFpa } from './qc.service';
import { resolveQcPolicy, createLot } from './lot.service';
import { ProcurementDomainError } from '../errors/procurement.error';
import { postSystemJournal, postStatisticalEvent, JournalLineInput } from './accounting-posting.service';
import { resolveValuation } from './valuation-policy.service';
import { resolveAccountByRole } from './account-role.service';
import { createCostLayer, linkCostLayerToJournal } from './inventory-costing.service';
import { toDbString, money, moneyRound } from '../lib/decimal';

// canonical approval state transitions
const APPROVAL_PENDING = 0;
const APPROVAL_STAGE_1 = 1;
const APPROVAL_FINAL = 2;
const APPROVAL_REJECTED = -1;

interface ApprovalResult {
  success: boolean;
  message: string;
  approval_status: number;
  alreadyApproved?: boolean;
}

interface PermissionSet {
  hasApprove: boolean;
  hasApprove1: boolean;
  hasApprove2: boolean;
}

// determine target approval_status from current status and user permissions
function resolveApprovalTarget(current: number, perms: PermissionSet): number | null {
  if (perms.hasApprove && current < APPROVAL_FINAL) return APPROVAL_FINAL;
  if (perms.hasApprove1 && current === APPROVAL_PENDING) return APPROVAL_STAGE_1;
  if (perms.hasApprove2 && current === APPROVAL_STAGE_1) return APPROVAL_FINAL;
  return null;
}

// enforce segregation of duties: stage-2 approver must differ from stage-1
function checkSegregation(
  target: number,
  userId: number,
  lockedRow: any,
  perms: PermissionSet
): void {
  if (target !== APPROVAL_FINAL) return;
  if (perms.hasApprove) return; // emergency override has its own audit

  const stage1Actor = lockedRow.approved_by_supervisor_id;
  if (stage1Actor && Number(stage1Actor) === userId) {
    throw new ProcurementDomainError(
      'SEGREGATION_VIOLATION',
      'Stage-2 approver must be different from stage-1 approver. Segregation of duties required.'
    );
  }
}

/**
 * Approve a Purchase Request.
 * Transaction + row lock + idempotency.
 */
export async function approvePurchaseRequest(
  prId: number,
  userId: number,
  perms: PermissionSet
): Promise<ApprovalResult> {
  return dbTransaction(async (conn: any) => {
    // row lock to prevent concurrent approval race
    const [rows] = await conn.execute(
      'SELECT id, approval_status, approved_by_supervisor_id FROM purchase_requests WHERE id = ? FOR UPDATE',
      [prId]
    );
    const pr = rows[0];
    if (!pr) throw new ProcurementDomainError('NOT_FOUND', 'Purchase request not found');

    const currentStatus = Number(pr.approval_status || 0);

    // idempotency first — check before permission so retry after timeout works
    if (currentStatus >= APPROVAL_FINAL) {
      return {
        success: true,
        message: `PR already at approval status ${currentStatus} (idempotent)`,
        approval_status: currentStatus,
        alreadyApproved: true
      };
    }

    const target = resolveApprovalTarget(currentStatus, perms);
    if (target === null) {
      throw new ProcurementDomainError(
        'INSUFFICIENT_PERMISSION',
        'Insufficient permissions to approve at current status'
      );
    }
    if (currentStatus >= target) {
      return {
        success: true,
        message: `PR already at approval status ${currentStatus} (idempotent)`,
        approval_status: currentStatus,
        alreadyApproved: true
      };
    }

    checkSegregation(target, userId, pr, perms);

    // stage 1 only
    if (target === APPROVAL_STAGE_1) {
      await conn.execute(
        `UPDATE purchase_requests
         SET approval_status = 1,
             approved_by_supervisor_id = ?,
             approved_at_supervisor = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [userId, prId]
      );
      return { success: true, message: 'PR approved (1/2)', approval_status: 1 };
    }

    // final approval (direct 0->2 or 1->2)
    if (perms.hasApprove) {
      // direct full approve
      await conn.execute(
        `UPDATE purchase_requests
         SET approval_status = 2,
             approved_by_supervisor_id = COALESCE(approved_by_supervisor_id, ?),
             approved_by_manager_id = ?,
             approved_at_supervisor = COALESCE(approved_at_supervisor, CURRENT_TIMESTAMP),
             approved_at_manager = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [userId, userId, prId]
      );
    } else {
      // stage 2 only
      await conn.execute(
        `UPDATE purchase_requests
         SET approval_status = 2,
             approved_by_manager_id = ?,
             approved_at_manager = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [userId, prId]
      );
    }

    return { success: true, message: 'PR fully approved', approval_status: 2 };
  });
}

/**
 * Approve a Purchase Order.
 * Transaction + row lock + idempotency.
 */
export async function approvePurchaseOrder(
  poId: number,
  userId: number,
  perms: PermissionSet
): Promise<ApprovalResult> {
  return dbTransaction(async (conn: any) => {
    const [rows] = await conn.execute(
      'SELECT id, approval_status, status, approved_by_supervisor_id FROM purchase_orders WHERE id = ? FOR UPDATE',
      [poId]
    );
    const po = rows[0];
    if (!po) throw new ProcurementDomainError('NOT_FOUND', 'Purchase order not found');

    const currentStatus = Number(po.approval_status || 0);

    // idempotency first
    if (currentStatus >= APPROVAL_FINAL) {
      return {
        success: true,
        message: `PO already at approval status ${currentStatus} (idempotent)`,
        approval_status: currentStatus,
        alreadyApproved: true
      };
    }

    const target = resolveApprovalTarget(currentStatus, perms);
    if (target === null) {
      throw new ProcurementDomainError(
        'INSUFFICIENT_PERMISSION',
        'Insufficient permissions to approve at current status'
      );
    }
    if (currentStatus >= target) {
      return {
        success: true,
        message: `PO already at approval status ${currentStatus} (idempotent)`,
        approval_status: currentStatus,
        alreadyApproved: true
      };
    }

    checkSegregation(target, userId, po, perms);

    if (target === APPROVAL_STAGE_1) {
      await conn.execute(
        `UPDATE purchase_orders
         SET approval_status = 1,
             approved_by_supervisor_id = ?,
             approved_at_supervisor = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [userId, poId]
      );
      return { success: true, message: 'PO approved (1/2)', approval_status: 1 };
    }

    // final approval
    if (perms.hasApprove) {
      await conn.execute(
        `UPDATE purchase_orders
         SET approval_status = 2, status = 'APPROVED',
             approved_by_supervisor_id = COALESCE(approved_by_supervisor_id, ?),
             approved_by_manager_id = ?,
             approved_at_supervisor = COALESCE(approved_at_supervisor, CURRENT_TIMESTAMP),
             approved_at_manager = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [userId, userId, poId]
      );
    } else {
      await conn.execute(
        `UPDATE purchase_orders
         SET approval_status = 2, status = 'APPROVED',
             approved_by_manager_id = ?,
             approved_at_manager = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [userId, poId]
      );
    }

    return { success: true, message: 'PO fully approved', approval_status: 2 };
  });
}

interface FrozenGrnLine {
  id: number;
  po_item_id: number;
  product_id: number;
  quantity_received: string;
  unit_cost: string;
  batch_number: string | null;
  remarks: string | null;
}

/**
 * Return the normalized lines for a goods receipt, materialising them from the draft payload
 * the first time. Once written the lines are the authority: the product comes from the PO
 * item rather than the request, and one row per PO item is enforced by the database.
 */
export async function freezeGrnLines(
  conn: any,
  grnId: number,
  draftNotes: string | null,
  poItemById: Map<number, any>
): Promise<FrozenGrnLine[]> {
  const [existing] = await conn.execute(
    'SELECT id, po_item_id, product_id, quantity_received, unit_cost, batch_number, remarks FROM grn_lines WHERE grn_id = ? ORDER BY po_item_id ASC FOR UPDATE',
    [grnId]
  );
  if ((existing as any[]).length > 0) return existing as FrozenGrnLine[];

  // first post for this receipt: derive the lines from the draft payload, validating each
  // one against the locked PO before anything is written
  let draftItems: any[] = [];
  try {
    draftItems = JSON.parse(draftNotes || '{}').items || [];
  } catch {
    draftItems = [];
  }

  const seenPoItems = new Set<number>();
  const toInsert: Array<[number, number, number, string, string, string | null, string | null]> = [];

  for (const item of draftItems) {
    const qty = money(String(item.received_quantity ?? '0'));
    if (qty.lessThanOrEqualTo(0)) continue; // partial receipts leave untouched lines at zero

    const poItemId = Number(item.po_item_id);
    if (!poItemId) {
      throw new ProcurementDomainError(
        'MISSING_LINEAGE',
        'A receipt line has no po_item_id; the PO line being received cannot be identified.'
      );
    }

    const poItem = poItemById.get(poItemId);
    if (!poItem) {
      throw new ProcurementDomainError(
        'MISSING_LINEAGE',
        `po_item_id ${poItemId} does not belong to this purchase order.`
      );
    }

    if (seenPoItems.has(poItemId)) {
      throw new ProcurementDomainError(
        'INVALID_GRN_LINE',
        `PO item ${poItemId} appears more than once on this receipt; combine them into a single line.`
      );
    }
    seenPoItems.add(poItemId);

    // the product is whatever the PO says it is. Accepting it from the request would let a
    // caller receive stock of one product against another product's PO line and price.
    const derivedProductId = Number(poItem.product_id);
    if (item.product_id && Number(item.product_id) !== derivedProductId) {
      throw new ProcurementDomainError(
        'INVALID_GRN_LINE',
        `Receipt line claims product ${item.product_id} but PO item ${poItemId} is for product ${derivedProductId}.`,
        { poItemId, claimedProductId: Number(item.product_id), poProductId: derivedProductId }
      );
    }

    toInsert.push([
      poItemId,
      derivedProductId,
      Number(poItem.unit_price) || 0,
      toDbString(qty),
      toDbString(moneyRound(money(String(poItem.unit_price || 0)))),
      item.batch_number || null,
      item.remarks || null,
    ] as any);
  }

  if (toInsert.length === 0) {
    throw new ProcurementDomainError(
      'EMPTY_RECEIPT',
      'This goods receipt has no line with a positive quantity.'
    );
  }

  for (const row of toInsert) {
    const [poItemId, productId, , qtyStr, unitCostStr, batchNumber, remarks] = row as any;
    await conn.execute(
      `INSERT INTO grn_lines (grn_id, po_item_id, product_id, quantity_received, unit_cost, batch_number, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [grnId, poItemId, productId, qtyStr, unitCostStr, batchNumber, remarks]
    );
  }

  const [frozen] = await conn.execute(
    'SELECT id, po_item_id, product_id, quantity_received, unit_cost, batch_number, remarks FROM grn_lines WHERE grn_id = ? ORDER BY po_item_id ASC FOR UPDATE',
    [grnId]
  );
  return frozen as FrozenGrnLine[];
}

/**
 * Post Goods Receipt (final GRN approval).
 * Single atomic transaction: GRN status -> received_qty -> QC HOLD inventory
 * -> stock movement -> Incoming QC FPA.
 * Row locking on PO items prevents concurrent over-receipt.
 */
export async function postGoodsReceipt(opts: {
  grnId: number;
  userId: number;
  perms: PermissionSet;
}): Promise<{ success: boolean; message: string; data?: any; alreadyApproved?: boolean }> {
  const { grnId, userId, perms } = opts;

  // load GRN outside transaction for early validation
  const grn = await dbGet('SELECT * FROM goods_receipts WHERE id = ?', [grnId]) as any;
  if (!grn) throw new ProcurementDomainError('NOT_FOUND', 'GRN not found');

  let currentStatus = Number(grn.approval_status || 0);

  // parse items from notes JSON
  let items: any[] = [];
  try {
    const parsedNotes = JSON.parse(grn.notes || '{}');
    items = parsedNotes.items || [];
  } catch {
    items = [];
  }

  // if rejected, reset inside a pre-transaction so the state is clean
  if (currentStatus === APPROVAL_REJECTED) {
    await dbTransaction(async (conn: any) => {
      const [rows] = await conn.execute('SELECT approval_status FROM goods_receipts WHERE id = ? FOR UPDATE', [grnId]);
      if (Number(rows[0]?.approval_status) === APPROVAL_REJECTED) {
        await conn.execute(
          `UPDATE goods_receipts
           SET approval_status = 0, status = 'received',
               approved_by_supervisor_id = NULL,
               approved_by_manager_id = NULL,
               approved_at_supervisor = NULL,
               approved_at_manager = NULL
           WHERE id = ?`,
          [grnId]
        );
      }
    });
    currentStatus = APPROVAL_PENDING;
  }

  // idempotency: check final status before permission to allow retry after timeout
  if (currentStatus >= APPROVAL_FINAL) {
    const finalData = await dbGet(
      `SELECT gr.*, po.po_number, w.name as warehouse_name, u.full_name as received_by_name
       FROM goods_receipts gr
       LEFT JOIN purchase_orders po ON gr.po_id = po.id
       LEFT JOIN warehouses w ON gr.warehouse_id = w.id
       LEFT JOIN users u ON gr.received_by = u.id
       WHERE gr.id = ?`,
      [grnId]
    );
    return { success: true, message: 'GRN already posted (idempotent)', data: finalData, alreadyApproved: true };
  }

  const target = resolveApprovalTarget(currentStatus, perms);
  if (target === null) {
    throw new ProcurementDomainError(
      'INSUFFICIENT_PERMISSION',
      'Insufficient permissions to approve at current status'
    );
  }

  // stage 1 only: no inventory side effects, but use FOR UPDATE
  if (target === APPROVAL_STAGE_1) {
    await dbTransaction(async (conn: any) => {
      const [lockRows] = await conn.execute(
        'SELECT id, approval_status, approved_by_supervisor_id FROM goods_receipts WHERE id = ? FOR UPDATE',
        [grnId]
      );
      const locked = lockRows[0];
      if (!locked) throw new ProcurementDomainError('NOT_FOUND', 'GRN not found');

      // idempotency under lock
      if (Number(locked.approval_status) >= APPROVAL_STAGE_1) return;

      await conn.execute(
        `UPDATE goods_receipts
         SET approval_status = 1, status = 'received',
             approved_by_supervisor_id = ?,
             approved_at_supervisor = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [userId, grnId]
      );
    });
    const finalData = await dbGet(
      `SELECT gr.*, po.po_number, w.name as warehouse_name, u.full_name as received_by_name
       FROM goods_receipts gr
       LEFT JOIN purchase_orders po ON gr.po_id = po.id
       LEFT JOIN warehouses w ON gr.warehouse_id = w.id
       LEFT JOIN users u ON gr.received_by = u.id
       WHERE gr.id = ?`,
      [grnId]
    );
    return { success: true, message: 'GRN approved (1/2)', data: finalData };
  }

  // final approval (-> 2): atomic transaction

  let result: any = null;
  await dbTransaction(async (conn: any) => {
    // lock GRN row first to prevent concurrent double-posting
    const [lockedGrnRows] = await conn.execute(
      'SELECT * FROM goods_receipts WHERE id = ? FOR UPDATE',
      [grnId]
    );
    const lockedGrn = lockedGrnRows[0];
    if (!lockedGrn) throw new ProcurementDomainError('NOT_FOUND', 'GRN not found');

    // idempotency check under lock
    if (lockedGrn.approval_status >= 2 || lockedGrn.status === 'approved') {
      result = { success: true, message: 'GRN already posted (idempotent)', alreadyApproved: true };
      return;
    }

    // segregation of duties under lock
    checkSegregation(target, userId, lockedGrn, perms);

    const [postedCheck] = await conn.execute(
      'SELECT COUNT(*) as cnt FROM stock_movements WHERE reference_type = ? AND reference_id = ?',
      ['GRN', grnId]
    );
    if ((postedCheck[0]?.cnt || 0) > 0) {
      await conn.execute(
        `UPDATE goods_receipts SET approval_status = 2, status = 'approved' WHERE id = ?`,
        [grnId]
      );
      result = { success: true, message: 'GRN already posted (idempotent)', alreadyApproved: true };
      return;
    }

    // 1. mark GRN as approved
    const approveFields = perms.hasApprove
      ? `approval_status = 2, status = 'approved',
         approved_by_supervisor_id = ?, approved_by_manager_id = ?,
         approved_at_supervisor = CURRENT_TIMESTAMP, approved_at_manager = CURRENT_TIMESTAMP`
      : `approval_status = 2, status = 'approved',
         approved_by_manager_id = ?,
         approved_at_manager = CURRENT_TIMESTAMP`;
    const approveParams = perms.hasApprove ? [userId, userId, grnId] : [userId, grnId];
    await conn.execute(
      `UPDATE goods_receipts SET ${approveFields} WHERE id = ?`,
      approveParams
    );

    // use locked GRN data for items
    const grnNumber = lockedGrn.grn_number || `GRN-${grnId}`;

    // 2. lock PO items first, in a fixed order: the receipt lines are derived from them
    const [poItems] = await conn.execute(
      'SELECT id, product_id, quantity, COALESCE(received_qty, 0) as received_qty, COALESCE(unit_price, 0) as unit_price FROM purchase_order_items WHERE purchase_order_id = ? ORDER BY id ASC FOR UPDATE',
      [lockedGrn.po_id]
    );
    const poItemById = new Map<number, any>();
    for (const poi of poItems) {
      poItemById.set(Number(poi.id), poi);
    }

    // resolve supplier from PO (not stale grn.vendor_id)
    const [poRows] = await conn.execute('SELECT vendor_id FROM purchase_orders WHERE id = ?', [lockedGrn.po_id]);
    const resolvedSupplierId = poRows[0]?.vendor_id || null;

    // the normalized lines are the authority for what was received; they are validated and
    // frozen against the locked PO, so the loop below no longer trusts the request payload
    const lockedItems = await freezeGrnLines(conn, grnId, lockedGrn.notes, poItemById);

    // 3. persist items
    const fpaQueue: { productId: number; batchNo: string | null; qty: number; lotId: number }[] = [];

    for (const item of lockedItems) {
      const poItemId = Number(item.po_item_id);
      const poItem = poItemById.get(poItemId);
      const qty = Number(item.quantity_received);

      // ceiling compared with decimal arithmetic against the locked PO row
      const ordered = money(String(poItem.quantity));
      const alreadyReceived = money(String(poItem.received_qty));
      const receiving = money(String(item.quantity_received));
      if (alreadyReceived.plus(receiving).greaterThan(ordered)) {
        throw new ProcurementDomainError(
          'OVER_RECEIPT',
          `Over-receipt rejected: PO item ${poItemId} ordered ${toDbString(ordered)}, already received ${toDbString(alreadyReceived)}, attempting ${toDbString(receiving)}.`,
          { poItemId, ordered: toDbString(ordered), alreadyReceived: toDbString(alreadyReceived) }
        );
      }

      // the price was snapshotted when the line was frozen, so a later PO edit cannot
      // change what this receipt was valued at
      const poUnitPrice = Number(item.unit_cost);

      // insert grn_items with cost snapshot
      const [grnItemResult] = await conn.execute(
        `INSERT INTO grn_items (grn_id, po_item_id, product_id, quantity_received, batch_number, notes, unit_cost, currency)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'IDR')`,
        [grnId, poItemId, item.product_id, qty, item.batch_number || null, item.remarks || null, poUnitPrice]
      );
      const grnItemId = grnItemResult.insertId;

      // create canonical lot for this receipt line
      const { lotId, lotNumber } = await createLot({
        productId: item.product_id,
        sourceType: 'grn_item',
        sourceDocumentId: grnId,
        sourceLineId: grnItemId,
        batchNumber: item.batch_number || null,
        supplierId: resolvedSupplierId,
        qcPolicy: await resolveQcPolicy(item.product_id, 'Incoming', conn),
        conn
      });

      // create inventory balance keyed to lot
      await conn.execute(
        `INSERT INTO inventory_stocks (warehouse_id, product_id, quantity, status, grn_id, lot_id, batch_number, source_type, source_id, reorder_point)
         VALUES (?, ?, ?, 'qc_hold', ?, ?, ?, 'grn', ?, 0)`,
        [lockedGrn.warehouse_id || 1, item.product_id, qty, grnId, lotId, item.batch_number || null, grnId]
      );

      // stock movement with lot reference
      await conn.execute(
        `INSERT INTO stock_movements
         (product_id, warehouse_id, reference_type, reference_id, quantity, movement_type, lot_id, notes, created_at)
         VALUES (?, ?, 'GRN', ?, ?, 'inbound', ?, ?, CURRENT_TIMESTAMP)`,
        [
          item.product_id,
          lockedGrn.warehouse_id,
          grnId,
          qty,
          lotId,
          `${grnNumber} lot ${lotNumber} - Receipt from PO ${lockedGrn.po_id} [QC_HOLD]${item.remarks ? ' - ' + item.remarks : ''}`
        ]
      );

      // update PO item received_qty
      await conn.execute(
        'UPDATE purchase_order_items SET received_qty = COALESCE(received_qty, 0) + ? WHERE id = ?',
        [qty, poItemId]
      );

      // phase 4: create cost layer for this receipt lot
      const qcPolicyForGl = await resolveQcPolicy(item.product_id, 'Incoming', conn);
      const costLayerId = await createCostLayer(conn, {
        lotId,
        productId: item.product_id,
        warehouseId: lockedGrn.warehouse_id || 1,
        quantity: String(qty),
        unitCost: String(poUnitPrice),
        sourceType: 'grn_item',
        sourceDocumentId: grnId,
        sourceLineId: grnItemId,
        costStatus: 'FINAL', // GRN cost from PO is final
        createdBy: userId,
      });

      // phase 4: GL journal for GRN receipt
      // Dr: Inventory (QC Hold or Available based on QC policy)
      // Cr: GRNI
      const grnBusinessDate = new Date().toISOString().slice(0, 10);
      const valuation = await resolveValuation(conn, {
        sourceEventType: 'GRN_POSTED',
        businessDate: grnBusinessDate,
        quantity: String(qty),
        unitCost: item.unit_cost,
        context: { grnId, grnItemId, productId: item.product_id, poItemId },
      });

      if (valuation.statistical) {
        // approved zero-value receipt: no journal is possible, but the event is recorded
        await postStatisticalEvent(conn, {
          sourceModule: 'PROCUREMENT',
          sourceType: 'goods_receipt',
          sourceId: grnId,
          sourceLineId: grnItemId,
          sourceEventType: 'GRN_POSTED',
          businessDate: grnBusinessDate,
          description: `GRN ${grnNumber} - zero-value receipt`,
          postingProfileId: valuation.profileId,
          idempotencyKey: `grn-post-${grnId}-${grnItemId}`,
          userId,
        });
      } else {
        const totalCostValue = valuation.amount;
        const debitRole = qcPolicyForGl === 'NOT_REQUIRED' ? 'INVENTORY_RM_AVAILABLE' : 'INVENTORY_RM_QC_HOLD';
        const debitAccount = await resolveAccountByRole(conn, debitRole, { warehouseId: lockedGrn.warehouse_id });
        const creditAccount = await resolveAccountByRole(conn, 'GRNI');

        // get product name for journal description
        const [prodRow] = await conn.execute('SELECT name FROM products WHERE id = ? LIMIT 1', [item.product_id]);
        const prodName = prodRow?.[0]?.name || `Product ${item.product_id}`;

        const glLines: JournalLineInput[] = [
          {
            accountId: debitAccount.accountId,
            description: `GRN ${grnNumber} - ${prodName} (${qty} units)`,
            debit: totalCostValue,
            credit: '0',
            productId: item.product_id,
            warehouseId: lockedGrn.warehouse_id || 1,
            lotId: lotId,
            vendorId: resolvedSupplierId,
          },
          {
            accountId: creditAccount.accountId,
            description: `GRN ${grnNumber} - ${prodName} GRNI`,
            debit: '0',
            credit: totalCostValue,
            vendorId: resolvedSupplierId,
          },
        ];

        const glResult = await postSystemJournal(conn, {
          sourceModule: 'PROCUREMENT',
          sourceType: 'goods_receipt',
          sourceId: grnId,
          sourceLineId: grnItemId,
          sourceEventType: 'GRN_POSTED',
          businessDate: new Date().toISOString().slice(0, 10),
          description: `GRN ${grnNumber} - ${prodName}`,
          lines: glLines,
          idempotencyKey: `grn-post-${grnId}-${grnItemId}`,
          userId,
        });

        await linkCostLayerToJournal(conn, costLayerId, glResult.journal_id);
      }

      fpaQueue.push({ productId: item.product_id, batchNo: item.batch_number || null, qty, lotId });
    }

    // update PO status
    const [updatedPoItems] = await conn.execute(
      'SELECT quantity, COALESCE(received_qty, 0) as received_qty FROM purchase_order_items WHERE purchase_order_id = ?',
      [lockedGrn.po_id]
    );
    const allFullyReceived = updatedPoItems.every(
      (i: any) => Number(i.received_qty) >= Number(i.quantity)
    );
    const someReceived = updatedPoItems.some(
      (i: any) => Number(i.received_qty) > 0
    );
    let newPoStatus = 'APPROVED';
    if (allFullyReceived) newPoStatus = 'RECEIVED';
    else if (someReceived) newPoStatus = 'PARTIAL';

    await conn.execute(
      'UPDATE purchase_orders SET status = ? WHERE id = ?',
      [newPoStatus, lockedGrn.po_id]
    );

    // one FPA per lot_id
    for (const entry of fpaQueue) {
      const qcPolicy = await resolveQcPolicy(entry.productId, 'Incoming', conn);

      if (qcPolicy === 'NOT_REQUIRED') {
        // bypass QC: release exact lot to available with full audit lineage
        await conn.execute(
          "UPDATE inventory_stocks SET status = 'available' WHERE warehouse_id = ? AND lot_id = ? AND status = 'qc_hold'",
          [lockedGrn.warehouse_id || 1, entry.lotId]
        );
        await conn.execute(
          `INSERT INTO stock_movements (product_id, warehouse_id, quantity, movement_type, reference_type, reference_id, lot_id, notes, created_at)
           VALUES (?, ?, ?, 'qc_release', 'GRN', ?, ?, ?, CURRENT_TIMESTAMP)`,
          [entry.productId, lockedGrn.warehouse_id, entry.qty, grnId, entry.lotId,
           `No-inspection release: QC NOT_REQUIRED for product ${entry.productId} on GRN ${grnNumber}`]
        );
        continue;
      }

      // REQUIRED: validate specs exist before creating FPA
      const fpaResult = await autoCreateFpa({
        conn,
        type: 'Incoming',
        productId: entry.productId,
        batchNo: entry.batchNo,
        supplierId: resolvedSupplierId,
        referenceId: grnId,
        referenceNumber: grnNumber,
        notes: `Auto-generated Incoming QC from GRN ${grnNumber} lot ${entry.lotId}`,
        createdBy: userId,
        quantity: entry.qty,
        lotId: entry.lotId
      });

      // REQUIRED + missing specs = full rollback
      if (!fpaResult) {
        throw new ProcurementDomainError(
          'QC_SPEC_REQUIRED',
          `Product ${entry.productId} has QC policy REQUIRED but no specifications configured. GRN posting rolled back.`
        );
      }
    }
  });

  // if already posted (idempotent), return early
  if (result) return result;

  const finalData = await dbGet(
    `SELECT gr.*, po.po_number, w.name as warehouse_name, u.full_name as received_by_name
     FROM goods_receipts gr
     LEFT JOIN purchase_orders po ON gr.po_id = po.id
     LEFT JOIN warehouses w ON gr.warehouse_id = w.id
     LEFT JOIN users u ON gr.received_by = u.id
     WHERE gr.id = ?`,
    [grnId]
  );

  return { success: true, message: 'GRN approval updated', data: finalData };
}
