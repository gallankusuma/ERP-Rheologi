-- Run manually on 2026-08-07 against both erp_rheologi and erp_rheologi_dev.
--
-- The permissions table had two generations of resource keys for most menus: an older set
-- (view/create/edit/delete/approve/export, seeded well before the current RBAC work — origin
-- unknown, not produced by any code currently in this repo) using resource keys derived from
-- `${topMenuId}.${topMenuId}-${submenuId}` (e.g. `inventory.inventory-dashboard`), and the
-- current set from `ensureMenuPermissions` in backend/src/config/database.ts, which is what
-- requirePermission() actually checks. Both showed under identical-looking module labels in
-- the Roles & Permissions UI (e.g. two "Inventory - Overview" view checkboxes), so admins had
-- no way to tell which checkbox was the live one — several roles ended up with the legacy,
-- functionally-dead resource checked instead of the real one, producing 403s despite the role
-- clearly having been granted access in the UI.
--
-- This migrates every existing grant on a legacy resource to its correct equivalent, wherever
-- one exists. Purely additive (INSERT IGNORE) — never deletes or modifies existing grants, so
-- it's safe to re-run.

CREATE TEMPORARY TABLE legacy_resource_map (
  legacy_resource VARCHAR(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  correct_resource VARCHAR(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL
);

INSERT INTO legacy_resource_map (legacy_resource, correct_resource) VALUES
  ('admin.roles', 'system.roles'),
  ('admin.system-settings', 'admin.settings'),
  ('approval.approval-history', 'approval.history'),
  ('approval.approval-inbox', 'approval.inbox'),
  ('approval.approval-rules', 'approval.rules'),
  ('dashboard.dashboard-alerts', 'dashboard.alerts'),
  ('dashboard.dashboard-approvals', 'dashboard.approvals'),
  ('dashboard.dashboard-inventory', 'dashboard.inventory'),
  ('dashboard.dashboard-overview', 'dashboard.overview'),
  ('dashboard.dashboard-production', 'dashboard.production'),
  ('dashboard.dashboard-sales', 'dashboard.sales'),
  ('estimator.estimator-ahsp', 'estimator.ahsp'),
  ('estimator.estimator-masters', 'estimator.masters'),
  ('estimator.estimator-proposals', 'estimator.proposals'),
  ('inventory.inventory-dashboard', 'inventory.dashboard'),
  ('inventory.warehouse-locations', 'master_data.warehouse-locations'),
  ('inventory.warehouses', 'master_data.warehouses'),
  ('master_data.employees', 'admin.users'),
  ('ppic.ppic-capacity', 'ppic.capacity'),
  ('ppic.ppic-forecast', 'ppic.forecast'),
  ('ppic.ppic-mps', 'ppic.mps'),
  ('ppic.ppic-mrp', 'ppic.mrp'),
  ('ppic.ppic-reports', 'ppic.reports'),
  ('procurement.procurement-dashboard', 'procurement.dashboard'),
  ('procurement.procurement-history', 'procurement.history'),
  ('production.issue-material', 'production.workorders'),
  ('production.production-execution', 'production.execution'),
  ('production.production-history', 'production.history'),
  ('production.production-planning', 'production.planning'),
  ('projects.clients', 'crm.clients'),
  ('projects.crm-dashboard', 'crm.dashboard'),
  ('projects.crm-sales', 'crm.sales'),
  ('projects.dashboard', 'crm.dashboard'),
  ('projects.leads', 'crm.leads'),
  ('projects.messages', 'crm.messages'),
  ('projects.notes', 'crm.notes'),
  ('projects.project-events', 'crm.events'),
  ('projects.projects', 'crm.projects'),
  ('projects.prospects', 'crm.prospects'),
  ('projects.sales', 'crm.sales'),
  ('projects.sample-requests', 'crm.sample-requests'),
  ('projects.tasks', 'crm.tasks'),
  ('quality.qc-reports', 'quality.reports'),
  ('quality.qc-results', 'quality.results'),
  ('quality.qc-sampling', 'quality.sampling'),
  ('quality.qc-test-methods', 'quality.test-methods'),
  ('reports.custom-reports', 'reports.custom'),
  ('reports.export-data', 'reports.export'),
  ('reports.finance-reports', 'reports.finance'),
  ('reports.inventory-reports', 'reports.inventory'),
  ('reports.procurement-reports', 'reports.procurement'),
  ('reports.production-reports', 'reports.production'),
  ('reports.qc-reports', 'reports.qc'),
  ('reports.sales-reports', 'reports.sales'),
  ('rnd.rnd-kanban', 'rnd.kanban'),
  ('sales.sales-contracts', 'crm.sales'),
  ('sales.sales-invoices', 'crm.sales'),
  ('sales.sales-items', 'crm.sales'),
  ('sales.sales-orders-list', 'crm.sales'),
  ('sales.sales-payments', 'crm.sales'),
  ('sales.sales-store', 'crm.sales');

-- Migrate view/create/delete as-is, and legacy 'edit' -> correct 'update'
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT DISTINCT rp.role_id, p2.id
FROM role_permissions rp
JOIN permissions p1 ON rp.permission_id = p1.id
JOIN legacy_resource_map m ON m.legacy_resource = p1.resource
JOIN permissions p2 ON p2.resource = m.correct_resource
  AND p2.action = CASE p1.action WHEN 'edit' THEN 'update' ELSE p1.action END
WHERE p1.action IN ('view', 'create', 'edit', 'delete');

-- Report what changed
SELECT r.name AS role, p.resource, p.action
FROM role_permissions rp
JOIN roles r ON rp.role_id = r.id
JOIN permissions p ON rp.permission_id = p.id
JOIN legacy_resource_map m ON m.correct_resource = p.resource
GROUP BY r.name, p.resource, p.action
ORDER BY r.name, p.resource, p.action;

DROP TEMPORARY TABLE legacy_resource_map;
