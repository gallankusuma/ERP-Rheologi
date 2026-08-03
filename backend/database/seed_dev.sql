-- Seed users from production
INSERT INTO users (username, email, password, full_name, user_level, is_active, role_id)
SELECT username, email, password, full_name, user_level, is_active, role_id 
FROM erp_rheologi.users;

-- Seed roles from production
INSERT IGNORE INTO roles (id, name, description)
SELECT id, name, description FROM erp_rheologi.roles;

-- Seed event types
INSERT IGNORE INTO event_types (id, name, color)
SELECT id, name, color FROM erp_rheologi.event_types;

-- Seed permissions
INSERT IGNORE INTO permissions (id, name, description, module, icon)
SELECT id, name, description, module, icon FROM erp_rheologi.permissions;

-- Seed role_permissions
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT role_id, permission_id FROM erp_rheologi.role_permissions;
