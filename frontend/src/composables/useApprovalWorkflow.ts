// Composable for 2-stage approval workflow
// approve_1 = Supervisor (step 1), approve_2 = Manager/Final (step 2)
import { useAuthStore } from '../stores/auth';

/**
 * Composable untuk mengelola approval workflow yang reusable
 * Digunakan untuk BOM, Inventory Transactions, Procurement, Finance, Quality, dll.
 * 
 * Approval Levels:
 * 0/2 = Pending
 * 1/2 = Supervisor Approved (approve_1)
 * 2/2 = Manager Approved / Final (approve_2)
 * 
 * Permission-based:
 * - approve_1: bisa approve status 0 → 1
 * - approve_2: bisa approve status 1 → 2
 * - approve (legacy): full approve (Director+)
 * 
 * Fallback: if no permissions data, fall back to user_level
 */
export function useApprovalWorkflow(moduleResource?: string) {
  const authStore = useAuthStore();

  /**
   * Helper: check if user has a specific permission for this module
   */
  const hasPerm = (action: string): boolean => {
    if (!moduleResource) return false;
    return authStore.hasPermission(`${moduleResource}.${action}`);
  };

  /**
   * Check jika user bisa approve dokumen berdasarkan status saat ini
   * 
   * Logic priority:
   * 1. Master Admin (Level 10+): always can approve
   * 2. If user has permissions data → check approve_1 / approve_2 / approve
   * 3. Fallback to user_level if no permissions (backward compat)
   */
  const canApprove = (currentStatus: number) => {
    const userLevel = authStore.user?.user_level || 1;
    const perms = authStore.user?.permissions;
    
    // Master Admin: always can approve anything not yet fully approved
    if (userLevel >= 10) {
      return currentStatus < 2;
    }

    // ── Permission-based logic (preferred) ──
    if (perms && perms.length > 0 && moduleResource) {
      const hasApprove1 = hasPerm('approve_1');
      const hasApprove2 = hasPerm('approve_2');
      const hasFullApprove = hasPerm('approve');

      // Full approve (legacy): can approve from any status < 2
      if (hasFullApprove && !hasApprove1 && !hasApprove2) {
        return currentStatus < 2;
      }

      // approve_1 only: can do step 0 → 1
      if (hasApprove1 && currentStatus === 0) {
        return true;
      }

      // approve_2 only: can do step 1 → 2
      if (hasApprove2 && currentStatus === 1) {
        return true;
      }

      // Has both approve_1 + approve_2 or full approve: Director-level
      if ((hasApprove1 && hasApprove2) || hasFullApprove) {
        return currentStatus < 2;
      }

      return false;
    }

    // ── Fallback: user_level based (backward compat) ──
    // Director & Master Admin (Level 4+): DIRECT APPROVAL
    if (userLevel >= 4) {
      return currentStatus < 2;
    }
    
    // Supervisor (Level 2): Hanya 0/2 → 1/2
    if (userLevel === 2) {
      return currentStatus === 0;
    }
    
    // Manager (Level 3): Hanya 1/2 → 2/2
    if (userLevel === 3) {
      return currentStatus === 1;
    }
    
    return false;
  };

  /**
   * Check jika user bisa reject/reset approval
   */
  const canReject = (currentStatus: number) => {
    const userLevel = authStore.user?.user_level || 1;
    const perms = authStore.user?.permissions;
    
    // Don't show reject for pending items — use delete instead
    if (currentStatus === 0) return false;

    // Master Admin: always can reject
    if (userLevel >= 10) {
      return currentStatus === 1 || currentStatus === 2;
    }

    // Permission-based
    if (perms && perms.length > 0 && moduleResource) {
      const hasApprove1 = hasPerm('approve_1');
      const hasApprove2 = hasPerm('approve_2');
      const hasFullApprove = hasPerm('approve');

      // Full approve or approve_2: can reject status 1 or 2
      if (hasFullApprove || hasApprove2) {
        return currentStatus === 1 || currentStatus === 2;
      }

      // approve_1 only: can reject status 1 (rollback own approval)
      if (hasApprove1) {
        return currentStatus === 1;
      }

      return false;
    }

    // Fallback: user_level
    if (userLevel >= 4) {
      return currentStatus === 1 || currentStatus === 2;
    }
    return userLevel >= 2 && currentStatus === 1;
  };

  /**
   * Check jika document fully approved dan locked for editing
   */
  const isFullyApproved = (status: number) => {
    return status === 2;
  };

  /**
   * Get approval status text untuk display di UI
   */
  const getApprovalStatusText = (status: number) => {
    switch(status) {
      case 0: return 'Pending (0/2)';
      case 1: return 'Approved 1/2';
      case 2: return 'Approved 2/2';
      default: return 'Pending (0/2)';
    }
  };

  /**
   * Get CSS class untuk status badge
   */
  const getApprovalStatusClass = (status: number) => {
    switch(status) {
      case 0: return 'bg-yellow-100 text-yellow-800';
      case 1: return 'bg-blue-100 text-blue-800';
      case 2: return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  /**
   * Get warning message jika user coba approve tapi belum boleh
   */
  const getApprovalMessage = (currentStatus: number) => {
    const userLevel = authStore.user?.user_level || 1;
    const perms = authStore.user?.permissions;

    // Master Admin: no warning
    if (userLevel >= 10) return '';

    // Permission-based check
    if (perms && perms.length > 0 && moduleResource) {
      const hasApprove1 = hasPerm('approve_1');
      const hasApprove2 = hasPerm('approve_2');
      const hasFullApprove = hasPerm('approve');

      if (hasFullApprove || (hasApprove1 && hasApprove2)) return '';
      
      // User has approve_2 but status is 0 (need approve_1 first)
      if (hasApprove2 && !hasApprove1 && currentStatus === 0) {
        return 'Approval Level 1 (Supervisor) must be completed first';
      }

      return '';
    }

    // Fallback
    if (userLevel >= 4) return '';
    if (userLevel === 3 && currentStatus === 0) {
      return 'Approval 1/2 (Supervisor) must be completed first';
    }
    return '';
  };

  /**
   * Get approval level name berdasarkan user permissions/level
   */
  const getApprovalLevelName = () => {
    const userLevel = authStore.user?.user_level || 1;
    const perms = authStore.user?.permissions;

    if (userLevel >= 10) return 'Master Admin';

    // Permission-based
    if (perms && perms.length > 0 && moduleResource) {
      const hasApprove1 = hasPerm('approve_1');
      const hasApprove2 = hasPerm('approve_2');
      const hasFullApprove = hasPerm('approve');

      if (hasFullApprove || (hasApprove1 && hasApprove2)) return 'Full Approver';
      if (hasApprove2) return 'Level 2 Approver';
      if (hasApprove1) return 'Level 1 Approver';
    }

    // Fallback
    if (userLevel >= 4) return 'Director';
    if (userLevel === 3) return 'Manager';
    if (userLevel === 2) return 'Supervisor';
    return 'User';
  };

  /**
   * Get next approval level text
   */
  const getNextApprovalLevel = (currentStatus: number) => {
    const userLevel = authStore.user?.user_level || 1;
    const perms = authStore.user?.permissions;

    if (userLevel >= 10) {
      return currentStatus < 2 ? 'DIRECT FULL APPROVAL (2/2 - FINAL)' : '';
    }

    // Permission-based
    if (perms && perms.length > 0 && moduleResource) {
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
    }

    // Fallback
    if (userLevel >= 4 && currentStatus < 2) {
      return 'DIRECT FULL APPROVAL (2/2 - FINAL)';
    }
    if (userLevel === 2 && currentStatus === 0) {
      return '1/2 (Supervisor Approval)';
    }
    if (userLevel >= 3 && currentStatus === 1) {
      return '2/2 (Manager Approval - Final)';
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
