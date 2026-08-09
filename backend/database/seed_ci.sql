-- CI-only seed: grant ALL permissions to role_id=1 (Admin)
-- This runs after initializeDatabase() has seeded all PPIC/procurement permissions.

-- Grant all permissions to Admin role (cross join)
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT 1, p.id FROM permissions p;
