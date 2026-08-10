import { dbAll, dbGet, dbRun } from '../config/database';

// canonical FPA status values
export type FpaCanonicalStatus = 'passed' | 'failed' | 'pending';

/**
 * Resolve canonical pass/fail/pending for a single FPA.
 * Checks all required analysis result rows (spec snapshots).
 */
export async function resolveFpaStatus(fpaId: number): Promise<FpaCanonicalStatus> {
  const results = await dbAll(
    `SELECT ar.id, ar.is_pass, ar.actual_value, ar.min_value, ar.max_value,
            ar.standard_value, ar.specification_id
     FROM qc_analysis_results ar
     WHERE ar.fpa_id = ?`,
    [fpaId]
  ) as any[];

  if (!results.length) return 'pending';

  // check linked spec is_required via specification_id
  let hasAnyFailed = false;
  let hasAnyPending = false;

  for (const r of results) {
    // check if this spec row is required
    let isRequired = true;
    if (r.specification_id) {
      const spec = await dbGet(
        'SELECT is_required FROM qc_specifications WHERE id = ?',
        [r.specification_id]
      ) as any;
      if (spec && spec.is_required === 0) {
        isRequired = false;
      }
    }

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
 * Sync FPA canonical status to linked wo_qc_checkpoint.
 * Production contract: status = pending | passed | failed
 */
export async function syncCheckpoint(fpaId: number, status: FpaCanonicalStatus): Promise<void> {
  const checkpoint = await dbGet(
    'SELECT id FROM wo_qc_checkpoints WHERE fpa_id = ?',
    [fpaId]
  ) as any;

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
 * Resolve FPA status and sync to checkpoint in one call.
 */
export async function resolveAndSync(fpaId: number): Promise<FpaCanonicalStatus> {
  const status = await resolveFpaStatus(fpaId);
  await syncCheckpoint(fpaId, status);
  return status;
}

/**
 * Check whether a batch can be released.
 * Requires: batch exists, not already released, all mandatory FPAs passed,
 * all qc_results for batch passed (if any).
 */
export async function canReleaseBatch(batchId: number): Promise<{ allowed: boolean; reason?: string }> {
  const batch = await dbGet('SELECT * FROM batches WHERE id = ?', [batchId]) as any;
  if (!batch) return { allowed: false, reason: 'Batch not found' };

  if (batch.status === 'released') return { allowed: true, reason: 'Already released (idempotent)' };

  // check FPAs linked to this batch
  const fpas = await dbAll(
    `SELECT id, status, result FROM qc_analysis_requests WHERE batch_no = ?`,
    [batch.batch_number]
  ) as any[];

  for (const fpa of fpas) {
    const canonical = await resolveFpaStatus(fpa.id);
    if (canonical === 'failed') {
      return { allowed: false, reason: `FPA #${fpa.id} has failed QC` };
    }
    if (canonical === 'pending') {
      return { allowed: false, reason: `FPA #${fpa.id} has pending QC results` };
    }
  }

  // check qc_results for this batch (quality.routes.ts system)
  const failedResults = await dbGet(
    `SELECT COUNT(*) as cnt FROM qc_results WHERE batch_id = ? AND result_status = 'failed'`,
    [batchId]
  ) as any;
  if (failedResults && failedResults.cnt > 0) {
    return { allowed: false, reason: 'Batch has failed QC test results' };
  }

  const pendingResults = await dbGet(
    `SELECT COUNT(*) as cnt FROM qc_results WHERE batch_id = ? AND (result_status IS NULL OR result_status = 'pending')`,
    [batchId]
  ) as any;
  if (pendingResults && pendingResults.cnt > 0) {
    return { allowed: false, reason: 'Batch has pending QC test results' };
  }

  return { allowed: true };
}

/**
 * Server-side pass/fail evaluation against spec snapshot.
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

  if (minValue !== null && minValue !== undefined && maxValue !== null && maxValue !== undefined) {
    return (num >= minValue && num <= maxValue) ? 1 : 0;
  }

  return null;
}
