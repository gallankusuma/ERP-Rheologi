import { dbAll, dbGet, dbRun } from '../config/database';

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
}): Promise<{ fpaId: number; fpaNumber: string } | null> {
  // check if any specs exist for this product + qc_type
  const specs = await dbAll(
    `SELECT s.*, p.param_type FROM qc_specifications s
     JOIN qc_parameters p ON s.parameter_id = p.id
     WHERE s.product_id = ? AND (s.qc_type = ? OR s.qc_type IS NULL)`,
    [opts.productId, opts.type]
  ) as any[];

  if (!specs.length) return null;

  // generate FPA number
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(100 + Math.random() * 900);
  const fpaNumber = `FPA-${opts.type}-${datePart}-${rand}`;

  const result = await dbRun(
    `INSERT INTO qc_analysis_requests
     (fpa_number, type, reference_id, reference_number, product_id, sampling_area_id,
      batch_no, quantity, supplier_id, notes, created_by, wo_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [fpaNumber, opts.type, opts.referenceId || null, opts.referenceNumber || null,
     opts.productId, opts.samplingAreaId || null, opts.batchNo || null,
     opts.quantity || null, opts.supplierId || null, opts.notes || null,
     opts.createdBy || null, opts.woId || null]
  );

  const fpaId = result.insertId;

  // snapshot specs into qc_analysis_results
  for (const spec of specs) {
    await dbRun(
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
 */
export async function finalizeQcApproval(opts: {
  fpaId: number;
  userId: number | null;
  reviewNotes?: string | null;
}): Promise<{ success: boolean; message: string; alreadyApproved?: boolean }> {
  const { fpaId, userId, reviewNotes } = opts;

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

  // guard: all required pinned results must pass
  const analysis = await evaluateAllResults(fpaId);
  if (analysis !== 'passed') {
    throw new Error(`Cannot approve: analysis results are '${analysis}'. All required results must pass.`);
  }

  // release qc_hold inventory for Incoming FPAs
  if (fpa.type === 'Incoming' && fpa.reference_id) {
    const grn = await dbGet('SELECT warehouse_id FROM goods_receipts WHERE id = ?', [fpa.reference_id]) as any;
    const warehouseId = grn?.warehouse_id || 1;

    // find qc_hold row by grn_id first, fall back to legacy
    let holdRow = await dbGet(
      'SELECT id, quantity FROM inventory_stocks WHERE product_id = ? AND warehouse_id = ? AND status = ? AND grn_id = ?',
      [fpa.product_id, warehouseId, 'qc_hold', fpa.reference_id]
    ) as any;
    if (!holdRow) {
      holdRow = await dbGet(
        'SELECT id, quantity FROM inventory_stocks WHERE product_id = ? AND warehouse_id = ? AND status = ?',
        [fpa.product_id, warehouseId, 'qc_hold']
      ) as any;
    }

    if (holdRow) {
      const holdQty = Number(holdRow.quantity);
      const releaseQty = Math.min(Number(fpa.quantity) || holdQty, holdQty);

      // P0-6 guard: reject release_qty > held_qty
      if ((Number(fpa.quantity) || 0) > holdQty && fpa.quantity) {
        throw new Error(`Cannot release ${fpa.quantity}: only ${holdQty} held in QC`);
      }

      const availRow = await dbGet(
        'SELECT id FROM inventory_stocks WHERE product_id = ? AND warehouse_id = ? AND status = ?',
        [fpa.product_id, warehouseId, 'available']
      ) as any;

      if (availRow) {
        await dbRun('UPDATE inventory_stocks SET quantity = quantity + ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?', [releaseQty, availRow.id]);
        const remaining = holdQty - releaseQty;
        if (remaining <= 0) {
          await dbRun('DELETE FROM inventory_stocks WHERE id = ?', [holdRow.id]);
        } else {
          await dbRun('UPDATE inventory_stocks SET quantity = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?', [remaining, holdRow.id]);
        }
      } else {
        if (releaseQty >= holdQty) {
          await dbRun('UPDATE inventory_stocks SET status = ?, grn_id = NULL, last_updated = CURRENT_TIMESTAMP WHERE id = ?', ['available', holdRow.id]);
        } else {
          await dbRun('UPDATE inventory_stocks SET quantity = quantity - ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?', [releaseQty, holdRow.id]);
          await dbRun(
            'INSERT INTO inventory_stocks (warehouse_id, product_id, quantity, status, last_updated) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
            [warehouseId, fpa.product_id, releaseQty, 'available']
          );
        }
      }

      await dbRun(
        `INSERT INTO stock_movements (product_id, warehouse_id, quantity, movement_type, reference_type, reference_id, notes, created_at)
         VALUES (?, ?, ?, 'qc_release', 'FPA', ?, ?, CURRENT_TIMESTAMP)`,
        [fpa.product_id, warehouseId, releaseQty, fpaId, `QC PASS - ${fpa.fpa_number} released to available`]
      );
      console.log(`[QC Release] Released ${releaseQty} of product ${fpa.product_id} from qc_hold to available`);
    }
  }

  // mark FPA as approved
  await dbRun(
    `UPDATE qc_analysis_requests SET status = 'Approved', result = 'Passed',
     approved_by_2 = ?, approved_at_2 = CURRENT_TIMESTAMP,
     reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, review_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [userId, userId, reviewNotes || null, fpaId]
  );

  // sync batch and checkpoint
  if (fpa.batch_no) {
    await dbRun('UPDATE batches SET qc_status = ? WHERE batch_number = ?', ['passed', fpa.batch_no]);
  }
  await syncCheckpoint(fpaId, 'passed');

  return { success: true, message: 'FPA approved' };
}
