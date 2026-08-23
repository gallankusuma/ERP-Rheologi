import { dbRun } from '../config/database';

// event types for QC audit trail
export type QcEventType =
  | 'fpa_created'
  | 'sample_received'
  | 'results_saved'
  | 'data_complete'
  | 'approve_l1'
  | 'approve_l2'
  | 'rejected'
  | 'resampled'
  | 'disposition'
  | 'status_changed';

export async function logQcEvent(
  fpaId: number,
  eventType: QcEventType | string,
  actorId: number | null,
  payload: Record<string, any> = {}
): Promise<void> {
  try {
    await dbRun(
      'INSERT INTO qc_audit_log (fpa_id, event_type, actor_id, payload) VALUES (?, ?, ?, ?)',
      [fpaId, eventType, actorId, JSON.stringify(payload)]
    );
  } catch (err: any) {
    // audit logging should never block the main flow
    console.error('qc audit log failed:', err.message);
  }
}
