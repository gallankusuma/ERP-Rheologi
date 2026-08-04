-- Sprint CRM: Add is_archived to leads and prospects for soft delete
-- Also add CRM permission entries

-- Add is_archived to leads if not exists (MySQL 8 compatible)
-- Note: prospects already has is_archived from the CREATE TABLE IF NOT EXISTS

-- Insert CRM permissions
INSERT IGNORE INTO permissions (resource, action, module, name, description)
VALUES 
  ('crm.prospects', 'create', 'CRM - Prospects', 'Create Prospect', 'Create new prospect'),
  ('crm.prospects', 'update', 'CRM - Prospects', 'Update Prospect', 'Edit prospect details'),
  ('crm.prospects', 'delete', 'CRM - Prospects', 'Delete Prospect', 'Archive prospect'),
  ('crm.prospects', 'convert', 'CRM - Prospects', 'Convert Prospect', 'Convert prospect to lead'),
  ('crm.prospects', 'view', 'CRM - Prospects', 'View Prospect', 'View prospect details'),
  ('crm.leads', 'create', 'CRM - Leads', 'Create Lead', 'Create new lead'),
  ('crm.leads', 'update', 'CRM - Leads', 'Update Lead', 'Edit lead details'),
  ('crm.leads', 'delete', 'CRM - Leads', 'Delete Lead', 'Archive lead'),
  ('crm.leads', 'convert', 'CRM - Leads', 'Convert Lead', 'Convert lead to client'),
  ('crm.leads', 'view', 'CRM - Leads', 'View Lead', 'View lead details');
