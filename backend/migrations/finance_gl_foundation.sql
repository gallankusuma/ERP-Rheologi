-- ============================================
-- PHASE 1: Chart of Accounts + General Ledger
-- Finance & Accounting Foundation
-- ============================================

-- 1. Chart of Accounts (COA)
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  account_code VARCHAR(20) NOT NULL UNIQUE,
  account_name VARCHAR(200) NOT NULL,
  account_type ENUM('asset','liability','equity','revenue','cogs','expense','other_income','tax') NOT NULL,
  parent_id INT DEFAULT NULL,
  level INT DEFAULT 1,
  is_header TINYINT(1) DEFAULT 0 COMMENT 'Header accounts cannot have journal entries',
  is_active TINYINT(1) DEFAULT 1,
  normal_balance ENUM('debit','credit') NOT NULL,
  description TEXT DEFAULT NULL,
  opening_balance DECIMAL(18,2) DEFAULT 0.00,
  current_balance DECIMAL(18,2) DEFAULT 0.00,
  currency VARCHAR(3) DEFAULT 'IDR',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
  INDEX idx_coa_type (account_type),
  INDEX idx_coa_parent (parent_id),
  INDEX idx_coa_code (account_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Fiscal Periods
CREATE TABLE IF NOT EXISTS fiscal_periods (
  id INT AUTO_INCREMENT PRIMARY KEY,
  period_name VARCHAR(50) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  fiscal_year INT NOT NULL,
  period_number INT NOT NULL COMMENT '1-12 for monthly',
  status ENUM('open','closing','closed') DEFAULT 'open',
  closed_by INT DEFAULT NULL,
  closed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_fiscal_period (fiscal_year, period_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Journal Entries (Header)
CREATE TABLE IF NOT EXISTS journal_entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  entry_number VARCHAR(30) NOT NULL UNIQUE,
  entry_date DATE NOT NULL,
  fiscal_period_id INT DEFAULT NULL,
  description TEXT NOT NULL,
  reference_type VARCHAR(50) DEFAULT NULL COMMENT 'invoice, payment, adjustment, etc.',
  reference_id INT DEFAULT NULL COMMENT 'ID of the source document',
  reference_number VARCHAR(50) DEFAULT NULL,
  total_debit DECIMAL(18,2) DEFAULT 0.00,
  total_credit DECIMAL(18,2) DEFAULT 0.00,
  status ENUM('draft','posted','voided') DEFAULT 'draft',
  is_auto_generated TINYINT(1) DEFAULT 0,
  posted_by INT DEFAULT NULL,
  posted_at TIMESTAMP NULL DEFAULT NULL,
  voided_by INT DEFAULT NULL,
  voided_at TIMESTAMP NULL DEFAULT NULL,
  void_reason TEXT DEFAULT NULL,
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (fiscal_period_id) REFERENCES fiscal_periods(id),
  INDEX idx_je_date (entry_date),
  INDEX idx_je_status (status),
  INDEX idx_je_ref (reference_type, reference_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Journal Lines (Detail)
CREATE TABLE IF NOT EXISTS journal_lines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  journal_entry_id INT NOT NULL,
  account_id INT NOT NULL,
  description VARCHAR(500) DEFAULT NULL,
  debit DECIMAL(18,2) DEFAULT 0.00,
  credit DECIMAL(18,2) DEFAULT 0.00,
  currency VARCHAR(3) DEFAULT 'IDR',
  exchange_rate DECIMAL(12,6) DEFAULT 1.000000,
  base_debit DECIMAL(18,2) DEFAULT 0.00 COMMENT 'Debit in base currency (IDR)',
  base_credit DECIMAL(18,2) DEFAULT 0.00 COMMENT 'Credit in base currency (IDR)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES chart_of_accounts(id),
  INDEX idx_jl_entry (journal_entry_id),
  INDEX idx_jl_account (account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. GL Account Balances (Period snapshots for fast reporting)
CREATE TABLE IF NOT EXISTS gl_balances (
  id INT AUTO_INCREMENT PRIMARY KEY,
  account_id INT NOT NULL,
  fiscal_period_id INT NOT NULL,
  opening_balance DECIMAL(18,2) DEFAULT 0.00,
  debit_total DECIMAL(18,2) DEFAULT 0.00,
  credit_total DECIMAL(18,2) DEFAULT 0.00,
  closing_balance DECIMAL(18,2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_gl_balance (account_id, fiscal_period_id),
  FOREIGN KEY (account_id) REFERENCES chart_of_accounts(id),
  FOREIGN KEY (fiscal_period_id) REFERENCES fiscal_periods(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- SEED: Default Chart of Accounts (PSAK)
-- ============================================

INSERT IGNORE INTO chart_of_accounts (account_code, account_name, account_type, parent_id, level, is_header, normal_balance, description) VALUES
-- ASSETS (1xxx)
('1000', 'Aset', 'asset', NULL, 1, 1, 'debit', 'Total Assets'),
('1100', 'Aset Lancar', 'asset', NULL, 1, 1, 'debit', 'Current Assets'),
('1110', 'Kas & Setara Kas', 'asset', NULL, 2, 0, 'debit', 'Cash & Cash Equivalents'),
('1111', 'Kas', 'asset', NULL, 3, 0, 'debit', 'Cash on Hand'),
('1112', 'Bank BCA', 'asset', NULL, 3, 0, 'debit', 'Bank BCA Account'),
('1113', 'Bank Mandiri', 'asset', NULL, 3, 0, 'debit', 'Bank Mandiri Account'),
('1120', 'Piutang Usaha', 'asset', NULL, 2, 0, 'debit', 'Accounts Receivable - Trade'),
('1130', 'Piutang Lain-lain', 'asset', NULL, 2, 0, 'debit', 'Other Receivables'),
('1140', 'Persediaan Bahan Baku', 'asset', NULL, 2, 0, 'debit', 'Raw Material Inventory'),
('1141', 'Persediaan Barang Dalam Proses', 'asset', NULL, 2, 0, 'debit', 'WIP Inventory'),
('1142', 'Persediaan Barang Jadi', 'asset', NULL, 2, 0, 'debit', 'Finished Goods Inventory'),
('1150', 'Biaya Dibayar Dimuka', 'asset', NULL, 2, 0, 'debit', 'Prepaid Expenses'),
('1160', 'Uang Muka', 'asset', NULL, 2, 0, 'debit', 'Advances'),
('1170', 'Pajak Dibayar Dimuka', 'asset', NULL, 2, 0, 'debit', 'Prepaid Taxes'),
-- Non-Current Assets
('1500', 'Aset Tidak Lancar', 'asset', NULL, 1, 1, 'debit', 'Non-Current Assets'),
('1510', 'Aset Tetap', 'asset', NULL, 2, 1, 'debit', 'Fixed Assets'),
('1511', 'Tanah', 'asset', NULL, 3, 0, 'debit', 'Land'),
('1512', 'Bangunan', 'asset', NULL, 3, 0, 'debit', 'Buildings'),
('1513', 'Mesin & Peralatan', 'asset', NULL, 3, 0, 'debit', 'Machinery & Equipment'),
('1514', 'Kendaraan', 'asset', NULL, 3, 0, 'debit', 'Vehicles'),
('1515', 'Peralatan Kantor', 'asset', NULL, 3, 0, 'debit', 'Office Equipment'),
('1519', 'Akumulasi Penyusutan', 'asset', NULL, 3, 0, 'credit', 'Accumulated Depreciation'),
('1520', 'Aset Tak Berwujud', 'asset', NULL, 2, 0, 'debit', 'Intangible Assets'),
('1530', 'Investasi Jangka Panjang', 'asset', NULL, 2, 0, 'debit', 'Long-term Investments'),

-- LIABILITIES (2xxx)
('2000', 'Liabilitas', 'liability', NULL, 1, 1, 'credit', 'Total Liabilities'),
('2100', 'Liabilitas Jangka Pendek', 'liability', NULL, 1, 1, 'credit', 'Current Liabilities'),
('2110', 'Utang Usaha', 'liability', NULL, 2, 0, 'credit', 'Accounts Payable - Trade'),
('2120', 'Utang Bank Jangka Pendek', 'liability', NULL, 2, 0, 'credit', 'Short-term Bank Loans'),
('2130', 'Utang Pajak', 'liability', NULL, 2, 0, 'credit', 'Tax Payable'),
('2131', 'Utang PPN', 'liability', NULL, 3, 0, 'credit', 'VAT Payable'),
('2132', 'Utang PPh 21', 'liability', NULL, 3, 0, 'credit', 'Employee Income Tax Payable'),
('2133', 'Utang PPh 23', 'liability', NULL, 3, 0, 'credit', 'Withholding Tax Payable'),
('2134', 'Utang PPh Badan', 'liability', NULL, 3, 0, 'credit', 'Corporate Income Tax Payable'),
('2140', 'Beban Akrual', 'liability', NULL, 2, 0, 'credit', 'Accrued Expenses'),
('2150', 'Utang Gaji', 'liability', NULL, 2, 0, 'credit', 'Salary Payable'),
('2160', 'Pendapatan Diterima Dimuka', 'liability', NULL, 2, 0, 'credit', 'Unearned Revenue'),
('2500', 'Liabilitas Jangka Panjang', 'liability', NULL, 1, 1, 'credit', 'Non-Current Liabilities'),
('2510', 'Utang Bank Jangka Panjang', 'liability', NULL, 2, 0, 'credit', 'Long-term Bank Loans'),
('2520', 'Liabilitas Pajak Tangguhan', 'liability', NULL, 2, 0, 'credit', 'Deferred Tax Liability'),
('2530', 'Liabilitas Imbalan Kerja', 'liability', NULL, 2, 0, 'credit', 'Employee Benefit Obligations'),

-- EQUITY (3xxx)
('3000', 'Ekuitas', 'equity', NULL, 1, 1, 'credit', 'Total Equity'),
('3100', 'Modal Saham', 'equity', NULL, 2, 0, 'credit', 'Share Capital'),
('3110', 'Modal Disetor', 'equity', NULL, 2, 0, 'credit', 'Paid-in Capital'),
('3200', 'Laba Ditahan', 'equity', NULL, 2, 0, 'credit', 'Retained Earnings'),
('3300', 'Pendapatan Komprehensif Lain', 'equity', NULL, 2, 0, 'credit', 'Other Comprehensive Income'),
('3400', 'Dividen', 'equity', NULL, 2, 0, 'debit', 'Dividends'),

-- REVENUE (4xxx)
('4000', 'Pendapatan', 'revenue', NULL, 1, 1, 'credit', 'Total Revenue'),
('4100', 'Pendapatan Penjualan', 'revenue', NULL, 2, 0, 'credit', 'Sales Revenue'),
('4110', 'Penjualan Produk', 'revenue', NULL, 3, 0, 'credit', 'Product Sales'),
('4120', 'Penjualan Jasa', 'revenue', NULL, 3, 0, 'credit', 'Service Revenue'),
('4130', 'Diskon Penjualan', 'revenue', NULL, 3, 0, 'debit', 'Sales Discounts'),
('4140', 'Retur Penjualan', 'revenue', NULL, 3, 0, 'debit', 'Sales Returns'),
('4200', 'Pendapatan Keuangan', 'other_income', NULL, 2, 0, 'credit', 'Finance Income'),
('4210', 'Pendapatan Bunga', 'other_income', NULL, 3, 0, 'credit', 'Interest Income'),
('4300', 'Pendapatan Lain-lain', 'other_income', NULL, 2, 0, 'credit', 'Other Income'),

-- COGS (5xxx)
('5000', 'Beban Pokok Penjualan', 'cogs', NULL, 1, 1, 'debit', 'Cost of Goods Sold'),
('5100', 'Bahan Baku', 'cogs', NULL, 2, 0, 'debit', 'Raw Materials Used'),
('5200', 'Tenaga Kerja Langsung', 'cogs', NULL, 2, 0, 'debit', 'Direct Labor'),
('5300', 'Overhead Produksi', 'cogs', NULL, 2, 0, 'debit', 'Manufacturing Overhead'),
('5400', 'Penyusutan Mesin Produksi', 'cogs', NULL, 2, 0, 'debit', 'Production Equipment Depreciation'),

-- OPERATING EXPENSES (6xxx)
('6000', 'Beban Usaha', 'expense', NULL, 1, 1, 'debit', 'Total Operating Expenses'),
('6100', 'Beban Penjualan', 'expense', NULL, 2, 1, 'debit', 'Selling Expenses'),
('6110', 'Beban Komisi Penjualan', 'expense', NULL, 3, 0, 'debit', 'Sales Commission'),
('6120', 'Beban Pengiriman', 'expense', NULL, 3, 0, 'debit', 'Shipping & Delivery'),
('6130', 'Beban Iklan & Promosi', 'expense', NULL, 3, 0, 'debit', 'Advertising & Promotion'),
('6200', 'Beban Umum & Administrasi', 'expense', NULL, 2, 1, 'debit', 'General & Administrative'),
('6210', 'Beban Gaji & Tunjangan', 'expense', NULL, 3, 0, 'debit', 'Salary & Benefits'),
('6220', 'Beban Sewa', 'expense', NULL, 3, 0, 'debit', 'Rent Expense'),
('6230', 'Beban Listrik & Air', 'expense', NULL, 3, 0, 'debit', 'Utilities'),
('6240', 'Beban Perlengkapan Kantor', 'expense', NULL, 3, 0, 'debit', 'Office Supplies'),
('6250', 'Beban Telepon & Internet', 'expense', NULL, 3, 0, 'debit', 'Telecom & Internet'),
('6260', 'Beban Perjalanan Dinas', 'expense', NULL, 3, 0, 'debit', 'Travel & Entertainment'),
('6270', 'Beban Penyusutan', 'expense', NULL, 3, 0, 'debit', 'Depreciation - Non-Production'),
('6280', 'Beban Asuransi', 'expense', NULL, 3, 0, 'debit', 'Insurance'),
('6290', 'Beban Umum Lainnya', 'expense', NULL, 3, 0, 'debit', 'Other G&A Expenses'),
('6300', 'Beban Penelitian & Pengembangan', 'expense', NULL, 2, 0, 'debit', 'R&D Expenses'),

-- OTHER INCOME/EXPENSES (7xxx)
('7000', 'Pendapatan/Beban Lain-lain', 'other_income', NULL, 1, 1, 'credit', 'Other Income/Expenses'),
('7100', 'Beban Keuangan', 'expense', NULL, 2, 0, 'debit', 'Finance Costs'),
('7110', 'Beban Bunga', 'expense', NULL, 3, 0, 'debit', 'Interest Expense'),
('7200', 'Laba (Rugi) Selisih Kurs', 'other_income', NULL, 2, 0, 'credit', 'FX Gain/Loss'),
('7300', 'Laba (Rugi) Penjualan Aset', 'other_income', NULL, 2, 0, 'credit', 'Gain/Loss on Asset Disposal'),
('7900', 'Beban Lain-lain', 'expense', NULL, 2, 0, 'debit', 'Other Expenses'),

-- TAX (8xxx)
('8000', 'Beban Pajak Penghasilan', 'tax', NULL, 1, 1, 'debit', 'Income Tax Expense'),
('8100', 'Pajak Kini', 'tax', NULL, 2, 0, 'debit', 'Current Tax'),
('8200', 'Pajak Tangguhan', 'tax', NULL, 2, 0, 'debit', 'Deferred Tax');

-- ============================================
-- SEED: Fiscal Periods 2025-2026
-- ============================================
INSERT IGNORE INTO fiscal_periods (period_name, start_date, end_date, fiscal_year, period_number) VALUES
('Jan 2025', '2025-01-01', '2025-01-31', 2025, 1),
('Feb 2025', '2025-02-01', '2025-02-28', 2025, 2),
('Mar 2025', '2025-03-01', '2025-03-31', 2025, 3),
('Apr 2025', '2025-04-01', '2025-04-30', 2025, 4),
('May 2025', '2025-05-01', '2025-05-31', 2025, 5),
('Jun 2025', '2025-06-01', '2025-06-30', 2025, 6),
('Jul 2025', '2025-07-01', '2025-07-31', 2025, 7),
('Aug 2025', '2025-08-01', '2025-08-31', 2025, 8),
('Sep 2025', '2025-09-01', '2025-09-30', 2025, 9),
('Oct 2025', '2025-10-01', '2025-10-31', 2025, 10),
('Nov 2025', '2025-11-01', '2025-11-30', 2025, 11),
('Dec 2025', '2025-12-01', '2025-12-31', 2025, 12),
('Jan 2026', '2026-01-01', '2026-01-31', 2026, 1),
('Feb 2026', '2026-02-01', '2026-02-28', 2026, 2),
('Mar 2026', '2026-03-01', '2026-03-31', 2026, 3),
('Apr 2026', '2026-04-01', '2026-04-30', 2026, 4),
('May 2026', '2026-05-01', '2026-05-31', 2026, 5),
('Jun 2026', '2026-06-01', '2026-06-30', 2026, 6),
('Jul 2026', '2026-07-01', '2026-07-31', 2026, 7),
('Aug 2026', '2026-08-01', '2026-08-31', 2026, 8),
('Sep 2026', '2026-09-01', '2026-09-30', 2026, 9),
('Oct 2026', '2026-10-01', '2026-10-31', 2026, 10),
('Nov 2026', '2026-11-01', '2026-11-30', 2026, 11),
('Dec 2026', '2026-12-01', '2026-12-31', 2026, 12);
