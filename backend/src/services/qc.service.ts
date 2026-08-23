import { dbAll, dbGet, dbRun, dbTransaction } from '../config/database';
import { postSystemJournal, postStatisticalEvent, JournalLineInput } from './accounting-posting.service';
import { resolveValuation, ValuationError } from './valuation-policy.service';
import { resolveAccountByRole } from './account-role.service';
import { getCostLayerForLot } from './inventory-costing.service';
import { toDbString, money, moneyRound } from '../lib/decimal';

// canonical FPA status values
export type FpaCanonicalStatus = 'passed' | 'failed' | 'pending';

// workflow statuses that mean "not done yet"
const PENDING_STATUSES = [
  'draft', 'pending', 'sample diterima', 'on progress', 'review', 'resampling'
];

/**
 * Pure analysis evaluator: checks pinned snapshot results only.
 * Does NOT consider FPA workflow status.
 */
export async function evaluateAllResults(fpaId: number): Promise<FpaCanonicalStatus> {
  const results = await dbAll(
    `SELECT ar.id, ar.is_pass, ar.actual_value, ar.min_value, ar.max_value,
            ar.standard_value, ar.is_required, ar.param_type
     FROM qc_analysis_results ar
     WHERE ar.fpa_id = ?`,
    [fpaId]
  ) as any[];

  if (!results.length) return 'pending';

  let hasAnyFailed = false;
  let hasAnyPending = false;

  for (const r of results) {
    // use pinned is_required from snapshot, not live spec
    const isRequired = r.is_required !== 0;
    if (!isRequired) continue;

    if (r.actual_value === null || r.actual_value === undefined || r.actual_value === '') {
      hasAnyPending = true;
    } else if (r.is_pass === 0) {
      hasAnyFailed = true;
    } else if (r.is_pass === null || r.is_pass === undefined) {
      hasAnyPending = true;
    }
  }

  if (hasAnyFailed) return 'failed';
  if (hasAnyPending) return 'pending';
  return 'passed';
}

/**
 * Transaction-aware evaluator: locks result rows FOR UPDATE.
 * Must be called within a transaction with conn.
 */
export async function evaluateAllResultsLocked(fpaId: number, conn: any): Promise<FpaCanonicalStatus> {
  const [results] = await conn.execute(
    `SELECT ar.id, ar.is_pass, ar.actual_value, ar.min_value, ar.max_value,
            ar.standard_value, ar.is_required, ar.param_type
     FROM qc_analysis_results ar
     WHERE ar.fpa_id = ?
     ORDER BY ar.id
     FOR UPDATE`,
    [fpaId]
  );

  if (!results.length) return 'pending';

  let hasAnyFailed = false;
  let hasAnyPending = false;

  for (const r of results) {
    const isRequired = r.is_required !== 0;
    if (!isRequired) continue;

    if (r.actual_value === null || r.actual_value === undefined || r.actual_value === '') {
      hasAnyPending = true;
    } else if (r.is_pass === 0) {
      hasAnyFailed = true;
    } else if (r.is_pass === null || r.is_pass === undefined) {
      hasAnyPending = true;
    }
  }

  if (hasAnyFailed) return 'failed';
  if (hasAnyPending) return 'pending';
  return 'passed';
}

/**
 * Workflow-aware resolver: considers FPA status + analysis results.
 * This is the canonical function for checkpoint sync and batch release.
 */
export async function resolveFpaWorkflow(fpaId: number): Promise<FpaCanonicalStatus> {
  const fpa = await dbGet(
    'SELECT id, status, result FROM qc_analysis_requests WHERE id = ?',
    [fpaId]
  ) as any;

  if (!fpa) return 'pending';

  const statusLower = (fpa.status || '').toLowerCase();

  // explicit rejection
  if (statusLower === 'rejected') return 'failed';

  // any non-final workflow status is pending
  if (PENDING_STATUSES.includes(statusLower)) return 'pending';

  // status = Approved: verify analysis results actually passed
  if (statusLower === 'approved') {
    const analysis = await evaluateAllResults(fpaId);
    return analysis === 'passed' ? 'passed' : 'failed';
  }

  // any unknown status: pending
  return 'pending';
}

/**
 * Sync FPA canonical status to linked wo_qc_checkpoint.
 * Production contract: status = pending | passed | failed
 * Supports both direct fpa_id link and root FPA chain.
 */
export async function syncCheckpoint(fpaId: number, status: FpaCanonicalStatus): Promise<void> {
  // check direct link first
  let checkpoint = await dbGet(
    'SELECT id FROM wo_qc_checkpoints WHERE fpa_id = ?',
    [fpaId]
  ) as any;

  // if no direct link, check if this is a child — find root and check root
  if (!checkpoint) {
    const fpa = await dbGet(
      'SELECT parent_fpa_id FROM qc_analysis_requests WHERE id = ?',
      [fpaId]
    ) as any;
    if (fpa && fpa.parent_fpa_id) {
      checkpoint = await dbGet(
        'SELECT id FROM wo_qc_checkpoints WHERE fpa_id = ?',
        [fpa.parent_fpa_id]
      ) as any;
    }
  }

  if (!checkpoint) return;

  if (status === 'passed' || status === 'failed') {
    await dbRun(
      'UPDATE wo_qc_checkpoints SET status = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, checkpoint.id]
    );
  } else {
    await dbRun(
      'UPDATE wo_qc_checkpoints SET status = ?, resolved_at = NULL WHERE id = ?',
      ['pending', checkpoint.id]
    );
  }
}

/**
 * Transaction-aware checkpoint sync for use inside dbTransaction callbacks.
 */
export async function syncCheckpointTx(conn: any, fpaId: number, status: FpaCanonicalStatus): Promise<void> {
  const [rows] = await conn.execute('SELECT id FROM wo_qc_checkpoints WHERE fpa_id = ?', [fpaId]);
  let checkpoint = (rows as any[])[0] || null;

  if (!checkpoint) {
    const [fpaRows] = await conn.execute('SELECT parent_fpa_id FROM qc_analysis_requests WHERE id = ?', [fpaId]);
    const fpa = (fpaRows as any[])[0];
    if (fpa?.parent_fpa_id) {
      const [parentRows] = await conn.execute('SELECT id FROM wo_qc_checkpoints WHERE fpa_id = ?', [fpa.parent_fpa_id]);
      checkpoint = (parentRows as any[])[0] || null;
    }
  }

  if (!checkpoint) return;

  if (status === 'passed' || status === 'failed') {
    await conn.execute('UPDATE wo_qc_checkpoints SET status = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?', [status, checkpoint.id]);
  } else {
    await conn.execute('UPDATE wo_qc_checkpoints SET status = ?, resolved_at = NULL WHERE id = ?', ['pending', checkpoint.id]);
  }
}

/**
 * Resolve FPA workflow status and sync to checkpoint in one call.
 */
export async function resolveAndSync(fpaId: number): Promise<FpaCanonicalStatus> {
  const status = await resolveFpaWorkflow(fpaId);
  await syncCheckpoint(fpaId, status);
  return status;
}

/**
 * Check whether a batch can be released.
 * Hardened: requires FPA evidence, Approved status, workflow = passed.
 * No legacy qc_results weak path.
 */
export async function canReleaseBatch(batchId: number): Promise<{ allowed: boolean; reason?: string }> {
  const batch = await dbGet('SELECT * FROM batches WHERE id = ?', [batchId]) as any;
  if (!batch) return { allowed: false, reason: 'Batch not found' };

  if (batch.status === 'released') return { allowed: true, reason: 'Already released (idempotent)' };

  // find FPAs linked to this batch
  const fpas = await dbAll(
    `SELECT id, status, result, parent_fpa_id, needs_resampling
     FROM qc_analysis_requests WHERE batch_no = ?`,
    [batch.batch_number]
  ) as any[];

  // no FPA = no QC evidence
  if (!fpas.length) {
    return { allowed: false, reason: 'No QC evidence - FPA required for batch release' };
  }

  // filter to active FPAs: skip parents that have been resampled
  const activeFpas = fpas.filter(f => !f.needs_resampling || f.needs_resampling === 0);

  if (!activeFpas.length) {
    return { allowed: false, reason: 'All FPAs are resampled - no active FPA with final decision' };
  }

  for (const fpa of activeFpas) {
    // must be explicitly Approved, not just results passing
    const statusLower = (fpa.status || '').toLowerCase();
    if (statusLower !== 'approved') {
      return { allowed: false, reason: `FPA #${fpa.id} is not approved (status: ${fpa.status})` };
    }

    // workflow resolver must agree
    const workflow = await resolveFpaWorkflow(fpa.id);
    if (workflow !== 'passed') {
      return { allowed: false, reason: `FPA #${fpa.id} workflow status: ${workflow}` };
    }
  }

  // batch qc_status must be passed
  if (batch.qc_status !== 'passed') {
    return { allowed: false, reason: `Batch qc_status is '${batch.qc_status || 'null'}', expected 'passed'` };
  }

  return { allowed: true };
}

/**
 * Server-side pass/fail evaluation against spec snapshot.
 * Supports min+max, min-only, max-only, qualitative.
 * Returns 1 (pass), 0 (fail), or null (cannot evaluate).
 */
export function evaluateResult(
  actualValue: string | number | null,
  minValue: number | null,
  maxValue: number | null,
  standardValue: string | null,
  paramType: string | null
): number | null {
  if (actualValue === null || actualValue === undefined || actualValue === '') return null;

  if (paramType === 'qualitative') {
    if (!standardValue) return null;
    const actual = String(actualValue).trim().toLowerCase();
    const standard = String(standardValue).trim().toLowerCase();
    return actual === standard ? 1 : 0;
  }

  // quantitative
  const num = Number(actualValue);
  if (isNaN(num)) return null;

  const hasMin = minValue !== null && minValue !== undefined;
  const hasMax = maxValue !== null && maxValue !== undefined;

  if (hasMin && hasMax) return (num >= minValue && num <= maxValue) ? 1 : 0;
  if (hasMin) return num >= minValue ? 1 : 0;
  if (hasMax) return num <= maxValue ? 1 : 0;

  return null;
}

/**
 * Auto-create an FPA with spec snapshot for a given product and qc_type.
 * Used by WO complete (FG), GRN approve (Incoming), Rework complete (FG re-test).
 * Returns null if no specs exist for the product+qcType combo.
 */
export async function autoCreateFpa(opts: {
  type: string;            // 'FG' | 'Incoming' | 'LP'
  productId: number;
  batchNo?: string | null;
  woId?: number | null;
  supplierId?: number | null;
  referenceId?: number | null;
  referenceNumber?: string | null;
  notes?: string | null;
  createdBy?: number | null;
  samplingAreaId?: number | null;
  quantity?: number | null;
  lotId?: number | null;   // PLAY-P0-4: canonical lot reference
  conn?: any;              // P0-2: optional transaction connection
}): Promise<{ fpaId: number; fpaNumber: string } | null> {
  // P0-2: use transaction connection if provided, otherwise fall back to pool
  const execQuery = async (sql: string, params: any[]): Promise<any> => {
    if (opts.conn) {
      const [result] = await opts.conn.execute(sql, params);
      return result;
    }
    return sql.trimStart().toUpperCase().startsWith('SELECT')
      ? dbAll(sql, params)
      : dbRun(sql, params);
  };

  // check if any specs exist for this product + qc_type
  const specs = await execQuery(
    `SELECT s.*, p.param_type FROM qc_specifications s
     JOIN qc_parameters p ON s.parameter_id = p.id
     WHERE s.product_id = ? AND (s.qc_type = ? OR s.qc_type IS NULL)`,
    [opts.productId, opts.type]
  ) as any[];

  if (!specs || !specs.length) return null;

  // generate FPA number
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(100 + Math.random() * 900);
  const fpaNumber = `FPA-${opts.type}-${datePart}-${rand}`;

  const result = await execQuery(
    `INSERT INTO qc_analysis_requests
     (fpa_number, type, reference_id, reference_number, product_id, sampling_area_id,
      batch_no, quantity, supplier_id, notes, created_by, wo_id, lot_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [fpaNumber, opts.type, opts.referenceId || null, opts.referenceNumber || null,
     opts.productId, opts.samplingAreaId || null, opts.batchNo || null,
     opts.quantity || null, opts.supplierId || null, opts.notes || null,
     opts.createdBy || null, opts.woId || null, opts.lotId || null]
  );

  const fpaId = result.insertId;

  // snapshot specs into qc_analysis_results
  for (const spec of specs) {
    await execQuery(
      `INSERT INTO qc_analysis_results
       (fpa_id, parameter_id, method_id, standard_value, min_value, max_value, uom, qc_type, specification_id, is_required, param_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [fpaId, spec.parameter_id, spec.method_id || null,
       spec.standard_value || null, spec.min_value ?? null, spec.max_value ?? null,
       spec.uom || null, spec.qc_type || null, spec.id,
       spec.is_required !== undefined ? spec.is_required : 1,
       spec.param_type || 'quantitative']
    );
  }

  return { fpaId, fpaNumber };
}

/**
 * P0-6: Canonical QC finalization service.
 * Both /approve and /approve-2 delegate here.
 * Handles: idempotency, releaseQty <= holdQty validation, 
 * transaction wrapping, stock release, checkpoint sync.
 * All inventory mutations are atomic within a single transaction.
 */
export async function finalizeQcApproval(opts: {
  fpaId: number;
  userId: number | null;
  reviewNotes?: string | null;
}): Promise<{ success: boolean; message: string; alreadyApproved?: boolean }> {
  const { fpaId, userId, reviewNotes } = opts;

  // pre-check outside transaction for fast-fail
  const fpa = await dbGet('SELECT * FROM qc_analysis_requests WHERE id = ?', [fpaId]) as any;
  if (!fpa) throw new Error('FPA not found');

  // idempotency: already finalized
  if (fpa.approved_by_2) {
    return { success: true, message: 'FPA already approved (idempotent)', alreadyApproved: true };
  }

  // guard: approve-1 must be done first
  if (!fpa.approved_by_1) {
    throw new Error('Approve #1 must be completed before final approval');
  }

  // SoD: approver-1 cannot be approver-2 (founder bypass via userLevel check in caller)
  if (fpa.approved_by_1 === userId) {
    throw new Error('Segregation of duties: Approver #1 cannot also be Approver #2');
  }

  // fast-fail: pre-check results outside transaction
  const preCheck = await evaluateAllResults(fpaId);
  if (preCheck !== 'passed') {
    throw new Error(`Cannot approve: analysis results are '${preCheck}'. All required results must pass.`);
  }

  // all mutations inside one transaction
  await dbTransaction(async (conn: any) => {
    // re-check idempotency under row lock
    const [fpaRows] = await conn.execute(
      'SELECT * FROM qc_analysis_requests WHERE id = ? FOR UPDATE',
      [fpaId]
    );
    const lockedFpa = fpaRows[0];
    if (!lockedFpa) throw new Error('FPA not found');
    if (lockedFpa.approved_by_2) return; // already done, skip all

    // REV3-P0-2: evaluate results under lock using transaction connection
    const lockedAnalysis = await evaluateAllResultsLocked(fpaId, conn);
    if (lockedAnalysis !== 'passed') {
      throw new Error(`Cannot approve: analysis results changed to '${lockedAnalysis}' during finalization.`);
    }

    // PLAY-NEXT-P0-4 + REV3-P0-3: release inventory using exact lot_id
    if ((lockedFpa.type === 'Incoming' || lockedFpa.type === 'FG') && lockedFpa.product_id) {
      // require lot_id on FPA for inventory release
      if (!lockedFpa.lot_id) {
        throw new Error(`QC_LOT_HOLD_NOT_FOUND: FPA ${lockedFpa.fpa_number} has no lot_id. Cannot release inventory without exact lot reference.`);
      }

      // REV3-P0-3: mandatory positive quantity
      const fpaQty = Number(lockedFpa.quantity);
      if (!fpaQty || fpaQty <= 0 || isNaN(fpaQty)) {
        throw new Error(`QC_RELEASE_QTY_CONFLICT: FPA ${lockedFpa.fpa_number} has invalid quantity (${lockedFpa.quantity}). Quantity must be a positive number.`);
      }

      // lock all holds for this lot to check for ambiguity
      const [holdRows] = await conn.execute(
        "SELECT id, quantity, warehouse_id, batch_number, lot_id, product_id FROM inventory_stocks WHERE lot_id = ? AND status = 'qc_hold' FOR UPDATE",
        [lockedFpa.lot_id]
      );

      if (holdRows.length === 0) {
        throw new Error(`QC_LOT_HOLD_NOT_FOUND: no QC-held inventory for lot ${lockedFpa.lot_id} (FPA ${lockedFpa.fpa_number}).`);
      }
      if (holdRows.length > 1) {
        throw new Error(`QC_LOT_HOLD_AMBIGUOUS: ${holdRows.length} hold rows found for lot ${lockedFpa.lot_id}. Expected exactly one.`);
      }

      const holdRow = holdRows[0];

      // validate product consistency
      if (holdRow.product_id !== lockedFpa.product_id) {
        throw new Error(`QC_LOT_HOLD_NOT_FOUND: FPA product ${lockedFpa.product_id} does not match hold product ${holdRow.product_id} for lot ${lockedFpa.lot_id}.`);
      }

      const warehouseId = holdRow.warehouse_id;
      const holdQty = Number(holdRow.quantity);
      const releaseQty = fpaQty;

      if (releaseQty > holdQty) {
        throw new Error(`QC_RELEASE_QTY_CONFLICT: FPA authorizes ${releaseQty} but only ${holdQty} held for lot ${lockedFpa.lot_id}.`);
      }

      // find or create available balance for the same lot
      const [availRows] = await conn.execute(
        "SELECT id FROM inventory_stocks WHERE warehouse_id = ? AND lot_id = ? AND status = 'available' FOR UPDATE",
        [warehouseId, lockedFpa.lot_id]
      );
      const availRow = availRows[0] || null;

      if (availRow) {
        // merge into existing available row for this lot
        await conn.execute(
          'UPDATE inventory_stocks SET quantity = quantity + ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?',
          [releaseQty, availRow.id]
        );
        const remaining = holdQty - releaseQty;
        if (remaining <= 0) {
          await conn.execute('DELETE FROM inventory_stocks WHERE id = ?', [holdRow.id]);
        } else {
          await conn.execute(
            'UPDATE inventory_stocks SET quantity = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?',
            [remaining, holdRow.id]
          );
        }
      } else {
        // no available row for this lot yet
        if (releaseQty >= holdQty) {
          // flip the hold row to available
          await conn.execute(
            "UPDATE inventory_stocks SET status = 'available', grn_id = NULL, last_updated = CURRENT_TIMESTAMP WHERE id = ?",
            [holdRow.id]
          );
        } else {
          // partial release: reduce hold, create available
          await conn.execute(
            'UPDATE inventory_stocks SET quantity = quantity - ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?',
            [releaseQty, holdRow.id]
          );
          await conn.execute(
            'INSERT INTO inventory_stocks (warehouse_id, product_id, quantity, status, lot_id, batch_number, last_updated) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
            [warehouseId, lockedFpa.product_id, releaseQty, 'available', lockedFpa.lot_id, holdRow.batch_number]
          );
        }
      }

      // release movement with lot_id
      await conn.execute(
        `INSERT INTO stock_movements (product_id, warehouse_id, quantity, movement_type, reference_type, reference_id, lot_id, notes, created_at)
         VALUES (?, ?, ?, 'qc_release', 'FPA', ?, ?, ?, CURRENT_TIMESTAMP)`,
        [lockedFpa.product_id, warehouseId, releaseQty, fpaId, lockedFpa.lot_id,
         `QC PASS - ${lockedFpa.fpa_number} lot ${lockedFpa.lot_id} released to available`]
      );

      // phase 4: GL reclassification journal for QC release
      // Dr: Inventory Available, Cr: Inventory QC Hold
      const costLayer = await getCostLayerForLot(conn, lockedFpa.lot_id);
      if (!costLayer) {
        // releasing stock whose cost is unknown would move goods out of QC hold with no
        // matching reclassification, leaving inventory value and the ledger disagreeing
        throw new ValuationError(
          'COST_LAYER_REQUIRED',
          `QC release for FPA ${lockedFpa.fpa_number} has no cost layer for lot ${lockedFpa.lot_id}; the lot cannot be valued.`,
          { fpaId, lotId: lockedFpa.lot_id, productId: lockedFpa.product_id }
        );
      }

      const qcBusinessDate = new Date().toISOString().slice(0, 10);
      const qcValuation = await resolveValuation(conn, {
        sourceEventType: 'QC_RELEASED',
        businessDate: qcBusinessDate,
        quantity: String(releaseQty),
        unitCost: costLayer.unitCost,
        context: { fpaId, lotId: lockedFpa.lot_id, productId: lockedFpa.product_id },
      });

      if (qcValuation.statistical) {
        await postStatisticalEvent(conn, {
          sourceModule: 'QC',
          sourceType: 'fpa',
          sourceId: fpaId,
          sourceEventType: 'QC_RELEASED',
          businessDate: qcBusinessDate,
          description: `QC Release - FPA ${lockedFpa.fpa_number} lot ${lockedFpa.lot_id} - zero-value`,
          postingProfileId: qcValuation.profileId,
          idempotencyKey: `qc-release-${fpaId}`,
          userId: userId || 0,
        });
      } else {
        const releaseAmount = qcValuation.amount;

        let debitRole: string;
        let creditRole: string;
        if (lockedFpa.type === 'FG') {
          debitRole = 'INVENTORY_FG_AVAILABLE';
          creditRole = 'INVENTORY_FG_QC_HOLD';
        } else {
          debitRole = 'INVENTORY_RM_AVAILABLE';
          creditRole = 'INVENTORY_RM_QC_HOLD';
        }

        const debitAccount = await resolveAccountByRole(conn, debitRole, { warehouseId });
        const creditAccount = await resolveAccountByRole(conn, creditRole, { warehouseId });

        const glLines: JournalLineInput[] = [
          {
            accountId: debitAccount.accountId,
            description: `QC Release - ${lockedFpa.fpa_number} lot ${lockedFpa.lot_id} (${releaseQty} units)`,
            debit: releaseAmount,
            credit: '0',
            productId: lockedFpa.product_id,
            warehouseId,
            lotId: lockedFpa.lot_id,
          },
          {
            accountId: creditAccount.accountId,
            description: `QC Release - ${lockedFpa.fpa_number} from QC Hold`,
            debit: '0',
            credit: releaseAmount,
            productId: lockedFpa.product_id,
            warehouseId,
            lotId: lockedFpa.lot_id,
          },
        ];

        await postSystemJournal(conn, {
          sourceModule: 'QC',
          sourceType: 'fpa',
          sourceId: fpaId,
          sourceEventType: 'QC_RELEASED',
          businessDate: new Date().toISOString().slice(0, 10),
          description: `QC Release - FPA ${lockedFpa.fpa_number} lot ${lockedFpa.lot_id}`,
          lines: glLines,
          idempotencyKey: `qc-release-${fpaId}`,
          userId: userId || 0,
        });
      }

      // for FG: check if ALL sibling lots/FPAs for this batch are passed before marking batch released
      if (lockedFpa.type === 'FG' && lockedFpa.batch_no) {
        // count unresolved sibling FPAs for the same batch
        const [siblingRows] = await conn.execute(
          `SELECT COUNT(*) AS pending_count FROM qc_analysis_requests
           WHERE batch_no = ? AND id != ? AND type = 'FG'
             AND (status NOT IN ('Approved', 'Cancelled') OR result NOT IN ('Passed'))`,
          [lockedFpa.batch_no, fpaId]
        );
        const pendingSiblings = Number((siblingRows as any[])[0]?.pending_count) || 0;

        if (pendingSiblings === 0) {
          // all sibling FPAs passed — safe to release batch
          await conn.execute(
            "UPDATE batches SET status = 'released', qc_status = 'passed' WHERE batch_number = ? AND status = 'pending_qc'",
            [lockedFpa.batch_no]
          );
        }
        // otherwise leave batch in pending_qc until all siblings are resolved
      }

      console.log(`[QC Release] Released ${releaseQty} of lot ${lockedFpa.lot_id} product ${lockedFpa.product_id} from qc_hold to available`);
    }

    // mark FPA as approved
    await conn.execute(
      `UPDATE qc_analysis_requests SET status = 'Approved', result = 'Passed',
       approved_by_2 = ?, approved_at_2 = CURRENT_TIMESTAMP,
       reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, review_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [userId, userId, reviewNotes || null, fpaId]
    );

    // sync batch aggregate status inside transaction
    if (lockedFpa.batch_no) {
      // recalculate: only mark batch passed if zero unresolved FPAs remain
      const [unresolvedRows] = await conn.execute(
        `SELECT COUNT(*) AS cnt FROM qc_analysis_requests
         WHERE batch_no = ? AND type = 'FG'
           AND status NOT IN ('Approved', 'Cancelled')`,
        [lockedFpa.batch_no]
      );
      const unresolvedCount = Number((unresolvedRows as any[])[0]?.cnt) || 0;
      if (unresolvedCount === 0) {
        await conn.execute('UPDATE batches SET qc_status = ? WHERE batch_number = ?', ['passed', lockedFpa.batch_no]);
      }
    }

    // P1-INT-2: sync checkpoint inside transaction to prevent approved-but-pending-checkpoint
    const checkpointFpaId = lockedFpa.parent_fpa_id || fpaId;
    await conn.execute(
      "UPDATE wo_qc_checkpoints SET status = 'passed', resolved_at = CURRENT_TIMESTAMP WHERE fpa_id = ? AND status != 'passed'",
      [checkpointFpaId]
    );
    // also try direct fpaId in case checkpoint points to this exact FPA
    if (checkpointFpaId !== fpaId) {
      await conn.execute(
        "UPDATE wo_qc_checkpoints SET status = 'passed', resolved_at = CURRENT_TIMESTAMP WHERE fpa_id = ? AND status != 'passed'",
        [fpaId]
      );
    }
  });

  return { success: true, message: 'FPA approved' };
}

/**
 * Named alias for Incoming QC release — matches Review.md canonical service naming.
 * Delegates to finalizeQcApproval which handles inventory release atomically.
 */
export const releaseIncomingQc = finalizeQcApproval;
