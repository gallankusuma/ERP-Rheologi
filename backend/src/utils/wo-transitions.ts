/**
 * Canonical WO state machine transitions.
 * Shared between workorder.routes.ts and production.routes.ts
 * so that every status change goes through the same validation.
 */

export const WO_TRANSITIONS: Record<string, string[]> = {
  'draft':       ['approved', 'cancelled'],
  'pending':     ['approved', 'cancelled'],        // legacy alias for draft
  'planned':     ['approved', 'cancelled'],         // legacy alias for draft
  'approved':    ['released', 'draft', 'cancelled'],
  'released':    ['in_progress', 'approved', 'cancelled'],
  'in_progress': ['on_hold', 'completed', 'cancelled'],
  'in-progress': ['on_hold', 'completed', 'cancelled'], // legacy
  'on_hold':     ['in_progress', 'cancelled'],
  'completed':   ['closed'],
  'closed':      [],                                 // terminal
  'cancelled':   [],                                 // terminal
};

// statuses that allow production start
export const STARTABLE_STATUSES = ['released'];

// statuses visible in execution list
export const EXECUTION_STATUSES = ['released', 'in_progress', 'on_hold'];

// statuses that allow material issue
export const ISSUABLE_STATUSES = ['released', 'in_progress', 'on_hold'];

/**
 * Statuses whose material demand is still OPEN, for MRP and shortage.
 *
 * Includes the legacy aliases on purpose: unlike the execution list, this is a
 * REPORT. Omitting a legacy-status WO understates demand, and understated
 * demand is a stockout — where showing one extra row costs a glance. The
 * execution list can afford to be strict because acting on the wrong WO is
 * worse than not seeing it; a requirements report cannot.
 *
 * 'released' was missing from both MRP queries entirely, so the WOs closest to
 * actually consuming material were the ones excluded from the shortage view.
 */
export const MRP_OPEN_STATUSES = [
  'released', 'in_progress', 'in-progress', 'on_hold',
  'approved', 'draft', 'pending', 'planned',
];

/**
 * Validate a WO status transition.
 * Returns { valid, error }.
 */
export function validateTransition(
  currentStatus: string,
  newStatus: string
): { valid: boolean; error?: string } {
  const normalized = currentStatus.toLowerCase();
  const allowed = WO_TRANSITIONS[normalized];
  if (!allowed) {
    return { valid: false, error: `Unknown current status '${currentStatus}'` };
  }
  if (!allowed.includes(newStatus.toLowerCase())) {
    return {
      valid: false,
      error: `Cannot transition from '${currentStatus}' to '${newStatus}'. Allowed: [${allowed.join(', ')}]`,
    };
  }
  return { valid: true };
}
