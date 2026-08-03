-- Seed roles first (before users)
INSERT IGNORE INTO erp_rheologi_dev.roles (id, name, description)
SELECT id, name, description FROM erp_rheologi.roles;

-- Update existing users with production passwords  
UPDATE erp_rheologi_dev.users u
JOIN erp_rheologi.users pu ON u.username = pu.username
SET u.password = pu.password, u.full_name = pu.full_name, u.user_level = pu.user_level, u.role_id = pu.role_id;

-- Insert missing users
INSERT IGNORE INTO erp_rheologi_dev.users (username, email, password, full_name, user_level, is_active, role_id)
SELECT username, email, password, full_name, user_level, is_active, role_id 
FROM erp_rheologi.users;

-- Seed event types
INSERT IGNORE INTO erp_rheologi_dev.event_types (id, name, color)
SELECT id, name, color FROM erp_rheologi.event_types;

-- Seed permissions
INSERT IGNORE INTO erp_rheologi_dev.permissions (id, name, description, module, icon)
SELECT id, name, description, module, icon FROM erp_rheologi.permissions;

-- Seed role_permissions
INSERT IGNORE INTO erp_rheologi_dev.role_permissions (role_id, permission_id)
SELECT role_id, permission_id FROM erp_rheologi.role_permissions;
