/**
 * ONE canonical Work Order status vocabulary for the UI.
 *
 * WHY THIS EXISTS. The Production screens were comparing the status COLUMN
 * against DISPLAY LABELS — `wo.status === 'In Production'`, `wo.status ===
 * 'Planned'`. The column never holds those strings; the backend state machine
 * stores `in_progress`, `released`, `on_hold` and so on. So those tests were
 * dead branches: every WO fell through to the "else" colour, and the filters
 * built on the same idea silently excluded real work orders.
 *
 * The review's instruction was to keep ONE canonical state set — the backend's —
 * and let the UI show a human label on top of it:
 *
 *     IN_PROGRESS  ->  "In Production"      value stays IN_PROGRESS
 *
 * That is exactly the split here: `woStatusLabel` is for the eye,
 * `normalizeWoStatus` is for logic, and nothing compares a rendered label back
 * to data. Mirrors WO_TRANSITIONS in backend/src/utils/wo-transitions.ts.
 */

/** Lowercase and collapse the legacy 'in-progress' spelling onto the canonical one. */
export function normalizeWoStatus(status: unknown): string {
  const s = String(status ?? '').toLowerCase().trim();
  return s === 'in-progress' ? 'in_progress' : s;
}

const LABELS: Record<string, string> = {
  draft: 'Draft',
  approved: 'Approved',
  released: 'Released',
  in_progress: 'In Production',
  on_hold: 'On Hold',
  completed: 'Completed',
  closed: 'Closed',
  cancelled: 'Cancelled',
  // Legacy values still present in older rows. Shown as themselves rather than
  // silently relabelled, so stale data is visible instead of disguised as a
  // canonical state.
  pending: 'Pending (legacy)',
  planned: 'Planned (legacy)',
};

export function woStatusLabel(status: unknown): string {
  const s = normalizeWoStatus(status);
  return LABELS[s] || String(status ?? '-');
}

const BADGES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  approved: 'bg-indigo-100 text-indigo-700',
  released: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-green-100 text-green-700',
  on_hold: 'bg-amber-100 text-amber-800',
  completed: 'bg-teal-100 text-teal-700',
  closed: 'bg-slate-200 text-slate-700',
  cancelled: 'bg-red-100 text-red-700',
  pending: 'bg-gray-100 text-gray-500',
  planned: 'bg-gray-100 text-gray-500',
};

export function woStatusBadge(status: unknown): string {
  return BADGES[normalizeWoStatus(status)] || 'bg-gray-100 text-gray-600';
}

/** Statuses material may be issued against — mirrors ISSUABLE_STATUSES. */
export const ISSUABLE_WO_STATUSES = ['released', 'in_progress', 'on_hold'];

/** Statuses visible in the execution screen — mirrors EXECUTION_STATUSES. */
export const EXECUTION_WO_STATUSES = ['released', 'in_progress', 'on_hold'];

export function isIssuable(status: unknown): boolean {
  return ISSUABLE_WO_STATUSES.includes(normalizeWoStatus(status));
}
