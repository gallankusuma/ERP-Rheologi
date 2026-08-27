-- HR Request Center permissions

INSERT IGNORE INTO permissions (resource, action, module, name, description) VALUES
('hr.requests', 'view', 'HR - Request Center', 'View HR Requests', 'View leave, permit, sickness, medical, and business trip requests'),
('hr.requests', 'create', 'HR - Request Center', 'Create HR Request', 'Create HR request on behalf of an employee'),
('hr.requests', 'approve', 'HR - Request Center', 'Approve HR Request', 'Approve employee HR requests'),
('hr.requests', 'reject', 'HR - Request Center', 'Reject HR Request', 'Reject employee HR requests'),
('hr.requests', 'update', 'HR - Request Center', 'Update HR Request', 'Update HR request status and decision notes');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r
  JOIN permissions p ON p.resource = 'hr.requests'
 WHERE r.name IN ('Admin', 'Super Admin', 'Super Administrator');
