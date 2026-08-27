// Maps each sidebar route to the permission resource that guards it on the backend.
// Must stay in sync with `menuPermissionModules` in backend/src/config/database.ts
// (plus the pre-existing crm.prospects / crm.leads / system.roles resources).
// Used by Layout.vue to hide menu items the current role can't view, and by the
// router guard to block direct navigation to the same pages.
export const ROUTE_PERMISSION_MAP: Record<string, string> = {
  // CRM
  '/crm': 'crm.dashboard',
  '/project/prospects': 'crm.prospects',
  '/leads': 'crm.leads',
  '/clients-management': 'crm.clients',
  '/clients': 'crm.clients',
  '/projects': 'crm.projects',
  '/sample-requests': 'crm.sample-requests',
  '/project/events': 'crm.events',
  '/project/tasks': 'crm.tasks',
  '/project/notes': 'crm.notes',
  '/notifications': 'crm.messages',
  '/mail': 'crm.messages',
  '/crm/sales': 'crm.sales',

  // Dashboard
  '/dashboard': 'dashboard.overview',
  '/dashboard/production': 'dashboard.production',
  '/dashboard/inventory': 'dashboard.inventory',
  '/dashboard/sales': 'dashboard.sales',
  '/dashboard/approvals': 'dashboard.approvals',
  '/dashboard/alerts': 'dashboard.alerts',

  // Estimator
  '/estimator': 'estimator.proposals',
  '/estimator/ahsp': 'estimator.ahsp',
  '/estimator/masters': 'estimator.masters',

  // R&D
  '/rnd/projects': 'rnd.rnd-projects',
  '/rnd/kanban': 'rnd.kanban',
  '/rnd/formulations': 'rnd.rnd-formulations',
  '/rnd/specifications': 'rnd.specifications',

  // PPIC
  '/ppic/forecast': 'ppic.forecast',
  '/ppic/mps': 'ppic.mps',
  '/ppic/mrp': 'ppic.mrp',
  '/ppic/capacity': 'ppic.capacity',
  '/ppic/reports': 'ppic.reports',

  // Procurement
  '/procurement': 'procurement.dashboard',
  '/procurement/pr': 'procurement.purchase-requests',
  '/procurement/po': 'procurement.purchase-orders',
  '/procurement/grn': 'procurement.grn',
  '/procurement/price-list': 'procurement.vendor-price-list',
  '/procurement/material-prices': 'procurement.material-price-comparison',
  '/procurement/history': 'procurement.history',

  // Inventory
  '/inventory': 'inventory.dashboard',
  '/inventory/overview': 'inventory.dashboard',
  '/inventory/stock-card': 'inventory.stock-card',
  '/inventory/transfer': 'inventory.stock-transfer',
  '/inventory/adjustment': 'inventory.stock-adjustment',
  '/inventory/opname': 'inventory.stock-opname',
  '/inventory/batch-tracking': 'inventory.batch-tracking',
  '/inventory/expiry': 'inventory.expiry-monitoring',

  // Production
  '/production/planning': 'production.planning',
  '/production/mrp': 'production.mrp',
  '/workorders': 'production.workorders',
  '/production/issue-material': 'production.workorders',
  '/production/execution': 'production.execution',
  '/production/yield': 'production.yield-scrap',
  '/production/fg-receipt': 'production.fg-receipt',
  '/production/history': 'production.history',

  // Quality
  '/qc/master': 'quality.qc-master',
  '/qc/fpa': 'quality.qc-fpa',
  '/quality/test-methods': 'quality.test-methods',
  '/quality/sampling': 'quality.sampling',
  '/quality/results': 'quality.results',
  '/quality/batch-release': 'quality.batch-release',
  '/quality/ncr': 'quality.ncr',
  '/quality/rework': 'quality.rework',
  '/quality/reports': 'quality.reports',

  // Finance
  '/finance/general-ledger': 'finance.general-ledger',
  '/finance/cogs': 'finance.cogs',
  '/finance/ap': 'finance.ap',
  '/finance/ar': 'finance.ar',
  '/finance/cost-analysis': 'finance.cost-analysis',
  '/finance/margin': 'finance.margin-analysis',
  '/finance/summary': 'finance.financial-summary',
  '/finance/fund-requests': 'finance.fund-requests',

  // HR
  '/hr': 'hr.command-center',
  '/hr/employees': 'hr.employees',
  '/hr/shift-roster': 'hr.shift-roster',
  '/hr/attendance': 'hr.attendance',
  '/hr/requests': 'hr.requests',
  '/hr/payroll': 'hr.payroll',
  '/hr/position-rates': 'hr.position-rates',
  '/hr/salary-advances': 'hr.salary-advances',
  '/hr/mobile-portal': 'hr.mobile-portal',

  // Approval
  '/approval/inbox': 'approval.inbox',
  '/approval/history': 'approval.history',
  '/approval/rules': 'approval.rules',
  '/approval/delegation': 'approval.delegation',
  '/approval/escalation': 'approval.escalation',

  // Reports
  '/reports/production': 'reports.production',
  '/reports/inventory': 'reports.inventory',
  '/reports/procurement': 'reports.procurement',
  '/reports/qc': 'reports.qc',
  '/reports/sales': 'reports.sales',
  '/reports/finance': 'reports.finance',
  '/reports/custom': 'reports.custom',
  '/reports/export': 'reports.export',

  // Master Data
  '/units': 'master_data.units',
  '/items': 'master_data.items',
  '/item-types': 'master_data.item-types',
  '/categories': 'master_data.categories',
  '/line-processes': 'master_data.line-processes',
  '/bom': 'master_data.bom',
  '/warehouses': 'master_data.warehouses',
  '/warehouse-locations': 'master_data.warehouse-locations',
  '/suppliers': 'master_data.suppliers',
  '/customers': 'master_data.customers',
  '/departments': 'master_data.departments',
  '/client-categories': 'master_data.client-categories',
  '/forecast-brands': 'master_data.forecast-brands',

  // Admin (Employees in Master Data also points to /users, sharing this same resource)
  '/users': 'admin.users',
  '/roles': 'system.roles',
  '/admin/settings': 'admin.settings',
  '/admin/approval-config': 'admin.approval-config',
  '/admin/audit-log': 'admin.audit-log',
  '/admin/notifications': 'admin.notifications',
  '/admin/integration': 'admin.integration',
  '/admin/document-control': 'admin.document-control',
  '/admin/backup': 'admin.backup',
};

/** Resolves the permission resource guarding a given path, matching sub-routes
 * (e.g. `/leads/42` inherits `/leads`'s resource) by longest-prefix match. */
export function getResourceForPath(path: string): string | null {
  let best: string | null = null;
  let bestLen = -1;
  for (const route in ROUTE_PERMISSION_MAP) {
    if (path === route || path.startsWith(route + '/')) {
      if (route.length > bestLen) {
        best = ROUTE_PERMISSION_MAP[route];
        bestLen = route.length;
      }
    }
  }
  return best;
}
