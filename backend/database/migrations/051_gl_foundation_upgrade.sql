-- Finance & General Ledger foundation
-- Ports existing finance_gl_foundation.sql into canonical migration stream
-- Extends schema per finance-general-ledger-blueprint.md §8

-- upgrade chart_of_accounts with blueprint fields
ALTER TABLE chart_of_accounts
  ADD COLUMN IF NOT EXISTS is_postable TINYINT(1) DEFAULT 1 COMMENT 'Non-postable accounts cannot receive journal lines',
  ADD COLUMN IF NOT EXISTS is_control_account TINYINT(1) DEFAULT 0 COMMENT 'Control accounts link to subledgers',
  ADD COLUMN IF NOT EXISTS control_subledger VARCHAR(20) DEFAULT NULL COMMENT 'AP, AR, BANK, INVENTORY, WIP, etc.',
  ADD COLUMN IF NOT EXISTS allow_manual_posting TINYINT(1) DEFAULT 1 COMMENT 'Control accounts normally reject manual journals',
  ADD COLUMN IF NOT EXISTS currency_policy ENUM('base_only','multi_currency') DEFAULT 'base_only',
  ADD COLUMN IF NOT EXISTS financial_statement_section VARCHAR(50) DEFAULT NULL COMMENT 'BS_CURRENT_ASSET, BS_FIXED_ASSET, PL_REVENUE, PL_COGS, PL_OPEX, etc.',
  ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0;

-- header accounts cannot be postable
UPDATE chart_of_accounts SET is_postable = 0 WHERE is_header = 1;

-- mark control accounts
UPDATE chart_of_accounts SET is_control_account = 1, control_subledger = 'AR', allow_manual_posting = 0
  WHERE account_code = '1120';
UPDATE chart_of_accounts SET is_control_account = 1, control_subledger = 'AP', allow_manual_posting = 0
  WHERE account_code = '2110';

-- set financial_statement_section based on account_type
UPDATE chart_of_accounts SET financial_statement_section = 'BS_CURRENT_ASSET'
  WHERE account_type = 'asset' AND account_code LIKE '11%';
UPDATE chart_of_accounts SET financial_statement_section = 'BS_FIXED_ASSET'
  WHERE account_type = 'asset' AND account_code LIKE '15%';
UPDATE chart_of_accounts SET financial_statement_section = 'BS_CURRENT_LIABILITY'
  WHERE account_type = 'liability' AND account_code LIKE '21%';
UPDATE chart_of_accounts SET financial_statement_section = 'BS_LT_LIABILITY'
  WHERE account_type = 'liability' AND account_code LIKE '25%';
UPDATE chart_of_accounts SET financial_statement_section = 'BS_EQUITY'
  WHERE account_type = 'equity';
UPDATE chart_of_accounts SET financial_statement_section = 'PL_REVENUE'
  WHERE account_type = 'revenue';
UPDATE chart_of_accounts SET financial_statement_section = 'PL_OTHER_INCOME'
  WHERE account_type = 'other_income';
UPDATE chart_of_accounts SET financial_statement_section = 'PL_COGS'
  WHERE account_type = 'cogs';
UPDATE chart_of_accounts SET financial_statement_section = 'PL_OPEX'
  WHERE account_type = 'expense';
UPDATE chart_of_accounts SET financial_statement_section = 'PL_TAX'
  WHERE account_type = 'tax';

-- add missing GL accounts from blueprint §20
INSERT IGNORE INTO chart_of_accounts (account_code, account_name, account_type, parent_id, level, is_header, normal_balance, description, is_postable, is_control_account, financial_statement_section) VALUES
('1143', 'Persediaan RM QC Hold', 'asset', NULL, 2, 0, 'debit', 'Raw Material QC Hold Inventory', 1, 0, 'BS_CURRENT_ASSET'),
('1144', 'Persediaan FG QC Hold', 'asset', NULL, 2, 0, 'debit', 'Finished Goods QC Hold Inventory', 1, 0, 'BS_CURRENT_ASSET'),
('1145', 'Persediaan Packaging', 'asset', NULL, 2, 0, 'debit', 'Packaging Material Inventory', 1, 0, 'BS_CURRENT_ASSET'),
('1121', 'Piutang Belum Ditagih', 'asset', NULL, 2, 0, 'debit', 'Unbilled Accounts Receivable', 1, 0, 'BS_CURRENT_ASSET'),
('2111', 'GRNI - Barang Diterima Belum Ditagih', 'liability', NULL, 3, 0, 'credit', 'Goods Received Not Invoiced', 1, 0, 'BS_CURRENT_LIABILITY'),
('2161', 'Uang Muka Karyawan', 'liability', NULL, 2, 0, 'credit', 'Employee Advances', 1, 0, 'BS_CURRENT_LIABILITY'),
('2162', 'Uang Muka Vendor', 'liability', NULL, 2, 0, 'credit', 'Vendor Advances', 1, 0, 'BS_CURRENT_LIABILITY'),
('5500', 'HPP Produk', 'cogs', NULL, 2, 0, 'debit', 'Cost of Goods Sold - Products', 1, 0, 'PL_COGS'),
('5600', 'Selisih Harga Beli', 'cogs', NULL, 2, 0, 'debit', 'Purchase Price Variance', 1, 0, 'PL_COGS'),
('5700', 'Selisih Produksi', 'cogs', NULL, 2, 0, 'debit', 'Production Variance', 1, 0, 'PL_COGS'),
('5800', 'Beban Scrap Abnormal', 'cogs', NULL, 2, 0, 'debit', 'Abnormal Scrap Expense', 1, 0, 'PL_COGS'),
('6295', 'Selisih Persediaan', 'expense', NULL, 3, 0, 'debit', 'Inventory Adjustment Gain/Loss', 1, 0, 'PL_OPEX'),
('7201', 'Laba Selisih Kurs', 'other_income', NULL, 3, 0, 'credit', 'FX Gain', 1, 0, 'PL_OTHER_INCOME'),
('7202', 'Rugi Selisih Kurs', 'expense', NULL, 3, 0, 'debit', 'FX Loss', 1, 0, 'PL_OPEX'),
('7901', 'Selisih Pembulatan', 'expense', NULL, 3, 0, 'debit', 'Rounding Difference', 1, 0, 'PL_OPEX');

-- upgrade fiscal_periods with soft-close support
ALTER TABLE fiscal_periods
  MODIFY COLUMN status ENUM('open','soft_closed','closed') DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS version INT DEFAULT 1 COMMENT 'Optimistic lock version',
  ADD COLUMN IF NOT EXISTS close_run_id INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reopened_by INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMP NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reopen_reason TEXT DEFAULT NULL;

-- seed 2027 fiscal periods
INSERT IGNORE INTO fiscal_periods (period_name, start_date, end_date, fiscal_year, period_number) VALUES
('Jan 2027', '2027-01-01', '2027-01-31', 2027, 1),
('Feb 2027', '2027-02-01', '2027-02-28', 2027, 2),
('Mar 2027', '2027-03-01', '2027-03-31', 2027, 3),
('Apr 2027', '2027-04-01', '2027-04-30', 2027, 4),
('May 2027', '2027-05-01', '2027-05-31', 2027, 5),
('Jun 2027', '2027-06-01', '2027-06-30', 2027, 6),
('Jul 2027', '2027-07-01', '2027-07-31', 2027, 7),
('Aug 2027', '2027-08-01', '2027-08-31', 2027, 8),
('Sep 2027', '2027-09-01', '2027-09-30', 2027, 9),
('Oct 2027', '2027-10-01', '2027-10-31', 2027, 10),
('Nov 2027', '2027-11-01', '2027-11-30', 2027, 11),
('Dec 2027', '2027-12-01', '2027-12-31', 2027, 12);

-- upgrade journal_entries with blueprint §8.5 fields
ALTER TABLE journal_entries
  MODIFY COLUMN status ENUM('draft','pending_approval','approved','posted','reversed') DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS journal_type ENUM('MANUAL','SYSTEM','OPENING','CLOSING','REVERSAL','ADJUSTMENT') DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS posting_date DATE DEFAULT NULL COMMENT 'Effective posting date (may differ from entry_date)',
  ADD COLUMN IF NOT EXISTS accounting_event_id INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS original_journal_id INT DEFAULT NULL COMMENT 'For reversal journals: the original posted entry',
  ADD COLUMN IF NOT EXISTS reversal_journal_id INT DEFAULT NULL COMMENT 'The reversal that reversed this entry',
  ADD COLUMN IF NOT EXISTS transaction_currency VARCHAR(3) DEFAULT 'IDR',
  ADD COLUMN IF NOT EXISTS base_currency VARCHAR(3) DEFAULT 'IDR',
  ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64) DEFAULT NULL COMMENT 'SHA-256 of frozen content for SoD/approval',
  ADD COLUMN IF NOT EXISTS approver_id INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reversed_by INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMP NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reversal_reason TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128) DEFAULT NULL;

ALTER TABLE journal_entries
  ADD INDEX IF NOT EXISTS idx_je_posting_date (posting_date),
  ADD INDEX IF NOT EXISTS idx_je_type (journal_type),
  ADD INDEX IF NOT EXISTS idx_je_event (accounting_event_id),
  ADD INDEX IF NOT EXISTS idx_je_original (original_journal_id);

-- unique idempotency key per journal
CREATE UNIQUE INDEX IF NOT EXISTS uq_je_idempotency ON journal_entries(idempotency_key);

-- upgrade journal_lines with blueprint §8.5 dimension fields
ALTER TABLE journal_lines
  ADD COLUMN IF NOT EXISTS line_number INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS cost_center_id INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS project_id INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS product_id INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS warehouse_id INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lot_id INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS vendor_id INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS customer_id INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS source_line_ref VARCHAR(100) DEFAULT NULL COMMENT 'Source document line reference';

-- upgrade money precision from DECIMAL(18,2) to DECIMAL(20,4)
ALTER TABLE journal_entries
  MODIFY COLUMN total_debit DECIMAL(20,4) DEFAULT 0.0000,
  MODIFY COLUMN total_credit DECIMAL(20,4) DEFAULT 0.0000;

ALTER TABLE journal_lines
  MODIFY COLUMN debit DECIMAL(20,4) DEFAULT 0.0000,
  MODIFY COLUMN credit DECIMAL(20,4) DEFAULT 0.0000,
  MODIFY COLUMN base_debit DECIMAL(20,4) DEFAULT 0.0000,
  MODIFY COLUMN base_credit DECIMAL(20,4) DEFAULT 0.0000,
  MODIFY COLUMN exchange_rate DECIMAL(20,10) DEFAULT 1.0000000000;

ALTER TABLE gl_balances
  MODIFY COLUMN opening_balance DECIMAL(20,4) DEFAULT 0.0000,
  MODIFY COLUMN debit_total DECIMAL(20,4) DEFAULT 0.0000,
  MODIFY COLUMN credit_total DECIMAL(20,4) DEFAULT 0.0000,
  MODIFY COLUMN closing_balance DECIMAL(20,4) DEFAULT 0.0000;

ALTER TABLE chart_of_accounts
  MODIFY COLUMN opening_balance DECIMAL(20,4) DEFAULT 0.0000,
  MODIFY COLUMN current_balance DECIMAL(20,4) DEFAULT 0.0000;
