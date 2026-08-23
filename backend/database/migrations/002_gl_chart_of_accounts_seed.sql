-- Base chart of accounts.
-- These rows previously lived only in backend/migrations/finance_gl_foundation.sql, which the
-- canonical runner never scans. Migration 051 adds supplementary accounts on top of this set,
-- and 052/054 resolve account_roles by account_code, so without this seed a fresh install
-- silently produces an unusable Finance configuration.
-- INSERT IGNORE keeps it idempotent and non-destructive on databases that already have a COA.

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

-- opening fiscal periods, same origin and same prerequisite role
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
