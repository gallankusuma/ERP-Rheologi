-- RBAC parity: add missing permission actions
-- stock-opname needs approve action (route uses 'inventory.stock-opname/approve')
INSERT IGNORE INTO permissions (resource, action, module, name, description) VALUES
('inventory.stock-opname', 'approve', 'Inventory - Stock Opname', 'Approve Stock Opname', 'Approve and post stock opname results'),
('inventory.stock-adjustment', 'approve', 'Inventory - Stock Adjustment', 'Approve Stock Adjustment', 'Approve stock adjustment requests');

-- GL permissions expansion for future use
INSERT IGNORE INTO permissions (resource, action, module, name, description) VALUES
('finance.general-ledger', 'submit', 'Finance - General Ledger', 'Submit Journal Entry', 'Submit journal entries for approval'),
('finance.general-ledger', 'approve', 'Finance - General Ledger', 'Approve Journal Entry', 'Approve submitted journal entries'),
('finance.general-ledger', 'post', 'Finance - General Ledger', 'Post Journal Entry', 'Post approved journal entries to ledger'),
('finance.general-ledger', 'reverse', 'Finance - General Ledger', 'Reverse Journal Entry', 'Create reversal entries'),
('finance.general-ledger', 'period_close', 'Finance - General Ledger', 'Close Period', 'Close accounting period');
