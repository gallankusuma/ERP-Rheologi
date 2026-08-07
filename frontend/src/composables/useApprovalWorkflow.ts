// Composable for 2-stage approval workflow
// approve_1 = Level 1 (step 1), approve_2 = Level 2/Final (step 2)
import { useAuthStore } from '../stores/auth';

/**
 * Composable untuk mengelola approval workflow yang reusable.
 * All access determined by Role Permissions (approve, approve_1, approve_2).
 */
export function useApprovalWorkflow(moduleResource?: string) {
  const authStore = useAuthStore();

  const hasPerm = (action: string): boolean => {
    if (!moduleResource) return false;
    return authStore.hasPermission(`${moduleResource}.${action}`);
  };

  // check if user can approve at current status
  const canApprove = (currentStatus: number) => {
    const hasApprove1 = hasPerm('approve_1');
    const hasApprove2 = hasPerm('approve_2');
    const hasFullApprove = hasPerm('approve');

    // full approve: can approve from any status < 2
    if (hasFullApprove && currentStatus < 2) return true;

    // approve_1: can do step 0 → 1
    if (hasApprove1 && currentStatus === 0) return true;

    // approve_2: can do step 1 → 2
    if (hasApprove2 && currentStatus === 1) return true;

    // both approve_1 + approve_2: can approve from any status < 2
    if (hasApprove1 && hasApprove2 && currentStatus < 2) return true;

    return false;
  };

  // check if user can reject
  const canReject = (currentStatus: number) => {
    if (currentStatus === 0) return false;

    const hasApprove1 = hasPerm('approve_1');
    const hasApprove2 = hasPerm('approve_2');
    const hasFullApprove = hasPerm('approve');

    if (hasFullApprove || hasApprove2) {
      return currentStatus === 1 || currentStatus === 2;
    }
    if (hasApprove1) {
      return currentStatus === 1;
    }
    return false;
  };

  const isFullyApproved = (status: number) => {
    return status === 2;
  };

  const getApprovalStatusText = (status: number) => {
    switch(status) {
      case 0: return 'Pending (0/2)';
      case 1: return 'Approved 1/2';
      case 2: return 'Approved 2/2';
      default: return 'Pending (0/2)';
    }
  };

  const getApprovalStatusClass = (status: number) => {
    switch(status) {
      case 0: return 'bg-yellow-100 text-yellow-800';
      case 1: return 'bg-blue-100 text-blue-800';
      case 2: return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getApprovalMessage = (currentStatus: number) => {
    const hasApprove1 = hasPerm('approve_1');
    const hasApprove2 = hasPerm('approve_2');
    const hasFullApprove = hasPerm('approve');

    if (hasFullApprove || (hasApprove1 && hasApprove2)) return '';
    if (hasApprove2 && !hasApprove1 && currentStatus === 0) {
      return 'Approval Level 1 must be completed first';
    }
    return '';
  };

  const getApprovalLevelName = () => {
    const hasApprove1 = hasPerm('approve_1');
    const hasApprove2 = hasPerm('approve_2');
    const hasFullApprove = hasPerm('approve');

    if (hasFullApprove || (hasApprove1 && hasApprove2)) return 'Full Approver';
    if (hasApprove2) return 'Level 2 Approver';
    if (hasApprove1) return 'Level 1 Approver';
    return 'User';
  };

  const getNextApprovalLevel = (currentStatus: number) => {
    const hasApprove1 = hasPerm('approve_1');
    const hasApprove2 = hasPerm('approve_2');
    const hasFullApprove = hasPerm('approve');

    if ((hasFullApprove || (hasApprove1 && hasApprove2)) && currentStatus < 2) {
      return 'DIRECT FULL APPROVAL (2/2 - FINAL)';
    }
    if (hasApprove1 && currentStatus === 0) {
      return '1/2 (Level 1 Approval)';
    }
    if (hasApprove2 && currentStatus === 1) {
      return '2/2 (Level 2 Approval - Final)';
    }
    return '';
  };

  return {
    canApprove,
    canReject,
    isFullyApproved,
    getApprovalStatusText,
    getApprovalStatusClass,
    getApprovalMessage,
    getApprovalLevelName,
    getNextApprovalLevel
  };
}
