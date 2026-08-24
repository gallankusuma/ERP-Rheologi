-- Chart of accounts and the GL read paths are now permission-gated rather than
-- authentication-only, so any signed-in user could previously read the ledger and every
-- financial report.
--
-- The catalog already defined finance.coa:* and finance.general-ledger:report, but no role
-- held them: gating the routes without this grant would lock every existing Finance user out
-- of screens they can use today. Each new permission is granted to exactly the roles that
-- already hold the equivalent one, so effective access is unchanged and only anonymous
-- breadth is removed.

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, target.id
  FROM role_permissions rp
  JOIN permissions src    ON src.id = rp.permission_id
  JOIN permissions target ON target.resource = 'finance.coa' AND target.action = 'view'
 WHERE src.resource = 'finance.general-ledger' AND src.action = 'view';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, target.id
  FROM role_permissions rp
  JOIN permissions src    ON src.id = rp.permission_id
  JOIN permissions target ON target.resource = 'finance.general-ledger' AND target.action = 'report'
 WHERE src.resource = 'finance.general-ledger' AND src.action = 'view';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, target.id
  FROM role_permissions rp
  JOIN permissions src    ON src.id = rp.permission_id
  JOIN permissions target ON target.resource = 'finance.coa' AND target.action = 'create'
 WHERE src.resource = 'finance.general-ledger' AND src.action = 'create';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, target.id
  FROM role_permissions rp
  JOIN permissions src    ON src.id = rp.permission_id
  JOIN permissions target ON target.resource = 'finance.coa' AND target.action = 'update'
 WHERE src.resource = 'finance.general-ledger' AND src.action = 'update';

-- accounts are deactivated, never physically deleted, so the old delete grant maps to it
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, target.id
  FROM role_permissions rp
  JOIN permissions src    ON src.id = rp.permission_id
  JOIN permissions target ON target.resource = 'finance.coa' AND target.action = 'deactivate'
 WHERE src.resource = 'finance.general-ledger' AND src.action = 'delete';
