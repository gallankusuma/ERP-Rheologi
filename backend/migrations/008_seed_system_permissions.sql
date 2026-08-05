-- Seed system.roles and system.permissions into permissions table
-- Run this once to ensure these permissions exist for role assignment

INSERT IGNORE INTO permissions (resource, action, module, name, description) VALUES
('system.roles', 'view', 'System', 'View Roles', 'View all roles and their permissions'),
('system.roles', 'create', 'System', 'Create Roles', 'Create new roles'),
('system.roles', 'update', 'System', 'Update Roles', 'Update existing roles'),
('system.roles', 'delete', 'System', 'Delete Roles', 'Delete roles'),
('system.roles', 'assign_permissions', 'System', 'Assign Permissions', 'Assign permissions to roles'),
('system.permissions', 'view', 'System', 'View Permissions', 'View all permissions'),
('system.permissions', 'manage', 'System', 'Manage Permissions', 'Create, update, and delete permissions');
