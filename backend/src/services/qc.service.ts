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
