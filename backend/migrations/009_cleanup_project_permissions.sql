-- Migration: Clean up duplicate projects.* permissions
-- Backend routes use crm.* resources, so projects.* are obsolete duplicates
-- Step 1: For each role that has projects.* perms, ensure it also has the crm.* equivalent
-- Step 2: Delete role_permissions pointing to projects.* 
-- Step 3: Delete projects.* permission records

-- Mapping: projects.clients -> crm.clients, projects.leads -> crm.leads, etc.
-- projects.project-events -> crm.events
-- projects.crm-dashboard -> crm.dashboard  
-- projects.crm-sales -> crm.sales
-- projects.prospects -> crm.prospects
-- projects.sample-requests -> crm.sample-requests

-- Step 1: For each role with projects.* perms, insert crm.* if not already assigned
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, crm_p.id
FROM role_permissions rp
JOIN permissions proj_p ON rp.permission_id = proj_p.id AND proj_p.resource LIKE 'projects.%'
JOIN permissions crm_p ON crm_p.resource = REPLACE(
  REPLACE(
    REPLACE(proj_p.resource, 'projects.project-events', 'crm.events'),
    'projects.crm-dashboard', 'crm.dashboard'
  ),
  'projects.crm-sales', 'crm.sales'
) AND crm_p.action = proj_p.action
WHERE crm_p.resource LIKE 'crm.%';

-- Handle simple mappings (projects.X -> crm.X)
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, crm_p.id
FROM role_permissions rp
JOIN permissions proj_p ON rp.permission_id = proj_p.id 
  AND proj_p.resource LIKE 'projects.%'
  AND proj_p.resource NOT IN ('projects.project-events', 'projects.crm-dashboard', 'projects.crm-sales')
JOIN permissions crm_p ON crm_p.resource = REPLACE(proj_p.resource, 'projects.', 'crm.') 
  AND crm_p.action = proj_p.action
WHERE crm_p.resource LIKE 'crm.%';

-- Step 2: Delete role_permissions pointing to projects.*
DELETE rp FROM role_permissions rp
JOIN permissions p ON rp.permission_id = p.id
WHERE p.resource LIKE 'projects.%';

-- Step 3: Delete the obsolete projects.* permission records
DELETE FROM permissions WHERE resource LIKE 'projects.%';

-- Verify
SELECT resource, action, module FROM permissions WHERE resource LIKE 'crm.%' ORDER BY resource, action;
