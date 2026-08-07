-- add crm.prospects.manage permission
-- this permission controls who can view all prospects vs only their own
INSERT INTO permissions (resource, action, module, name)
SELECT 'crm.prospects', 'manage', 'CRM - Prospects', 'Manage All Prospects'
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM permissions WHERE resource = 'crm.prospects' AND action = 'manage'
);
