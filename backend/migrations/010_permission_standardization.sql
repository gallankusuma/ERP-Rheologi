-- Phase 1: Standardize edit → update
-- Step 1: For resources that have BOTH edit and update permissions,
-- migrate role_permissions from edit_id → update_id, then delete edit permission

-- First, migrate role_permissions from edit to update (for overlapping resources)
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, p_update.id
FROM role_permissions rp
JOIN permissions p_edit ON rp.permission_id = p_edit.id AND p_edit.action = 'edit'
JOIN permissions p_update ON p_edit.resource = p_update.resource AND p_update.action = 'update';

-- Delete the old edit role_permissions (now redundant)
DELETE rp FROM role_permissions rp
JOIN permissions p ON rp.permission_id = p.id
WHERE p.action = 'edit'
AND EXISTS (SELECT 1 FROM permissions p2 WHERE p2.resource = p.resource AND p2.action = 'update');

-- Delete the edit permissions that now have update equivalents
DELETE FROM permissions
WHERE action = 'edit'
AND EXISTS (SELECT 1 FROM permissions p2 WHERE p2.resource = permissions.resource AND p2.action = 'update');

-- Step 2: For resources that ONLY have edit (no update), rename edit → update
UPDATE permissions SET action = 'update' WHERE action = 'edit';

-- Step 3: Ensure Admin (role_id=1) has ALL permissions
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT 1, id FROM permissions;

-- Step 4: Verify
SELECT 'edit perms remaining' as label, COUNT(*) as cnt FROM permissions WHERE action = 'edit'
UNION ALL
SELECT 'update perms', COUNT(*) FROM permissions WHERE action = 'update'
UNION ALL
SELECT 'total perms', COUNT(*) FROM permissions
UNION ALL
SELECT 'admin role_perms', COUNT(*) FROM role_permissions WHERE role_id = 1
UNION ALL
SELECT 'total role_perms', COUNT(*) FROM role_permissions;
