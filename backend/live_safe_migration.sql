-- =====================================================
-- LIVE SAFE MIGRATION — ADDITIVE ONLY
-- Database: erp_rheologi (LIVE)
-- Date: 2026-05-29
-- =====================================================
-- SAFETY: Only INSERT ... ON DUPLICATE KEY / INSERT IGNORE
-- SAFETY: No DELETE, no DROP, no TRUNCATE, no UPDATE on existing rows
-- =====================================================

-- 1. QC Methods (INSERT IGNORE to skip if already exists)
INSERT IGNORE INTO qc_methods (name, description) VALUES
('Viscometer Brookfield', 'Pengukuran viskositas menggunakan Viscometer Brookfield RVT'),
('pH Meter Digital', 'Pengukuran pH menggunakan pH Meter Hanna HI98190'),
('Hydrometer', 'Pengukuran berat jenis dengan Hydrometer ASTM'),
('Visual Inspection', 'Pemeriksaan visual secara langsung'),
('Titration', 'Titrasi untuk penentuan kadar aktif');

SELECT 'QC Methods' AS module, COUNT(*) AS total FROM qc_methods;

-- 2. QC Parameters (INSERT IGNORE to skip if already exists)
INSERT IGNORE INTO qc_parameters (name, description) VALUES
('Viscosity', 'Kekentalan produk dalam cPs'),
('pH Level', 'Tingkat keasaman/kebasaan'),
('Specific Gravity', 'Berat jenis relatif terhadap air'),
('Appearance', 'Tampilan visual produk'),
('Active Content', 'Kadar bahan aktif dalam %'),
('Color', 'Warna produk');

SELECT 'QC Parameters' AS module, COUNT(*) AS total FROM qc_parameters;

-- 3. QC Specifications for Pellicle (product_id=68) — only if not already set
-- Check first if specs already exist for this product
INSERT IGNORE INTO qc_specifications (product_id, qc_type, parameter_id, method_id, standard_value, min_value, max_value, uom)
SELECT 68, 'LP', p.id, m.id, '5000', 4500.0000, 5500.0000, 'cPs'
FROM qc_parameters p, qc_methods m WHERE p.name='Viscosity' AND m.name='Viscometer Brookfield'
AND NOT EXISTS (SELECT 1 FROM qc_specifications WHERE product_id=68 AND parameter_id=p.id AND qc_type='LP');

INSERT IGNORE INTO qc_specifications (product_id, qc_type, parameter_id, method_id, standard_value, min_value, max_value, uom)
SELECT 68, 'LP', p.id, m.id, '7.0', 6.5000, 7.5000, 'pH'
FROM qc_parameters p, qc_methods m WHERE p.name='pH Level' AND m.name='pH Meter Digital'
AND NOT EXISTS (SELECT 1 FROM qc_specifications WHERE product_id=68 AND parameter_id=p.id AND qc_type='LP');

INSERT IGNORE INTO qc_specifications (product_id, qc_type, parameter_id, method_id, standard_value, min_value, max_value, uom)
SELECT 68, 'LP', p.id, m.id, '1.05', 1.0300, 1.0700, 'g/cm3'
FROM qc_parameters p, qc_methods m WHERE p.name='Specific Gravity' AND m.name='Hydrometer'
AND NOT EXISTS (SELECT 1 FROM qc_specifications WHERE product_id=68 AND parameter_id=p.id AND qc_type='LP');

INSERT IGNORE INTO qc_specifications (product_id, qc_type, parameter_id, method_id, standard_value, min_value, max_value, uom)
SELECT 68, 'LP', p.id, m.id, 'Clear gel', NULL, NULL, '-'
FROM qc_parameters p, qc_methods m WHERE p.name='Appearance' AND m.name='Visual Inspection'
AND NOT EXISTS (SELECT 1 FROM qc_specifications WHERE product_id=68 AND parameter_id=p.id AND qc_type='LP');

INSERT IGNORE INTO qc_specifications (product_id, qc_type, parameter_id, method_id, standard_value, min_value, max_value, uom)
SELECT 68, 'LP', p.id, m.id, '2.5', 2.3000, 2.7000, '%'
FROM qc_parameters p, qc_methods m WHERE p.name='Active Content' AND m.name='Titration'
AND NOT EXISTS (SELECT 1 FROM qc_specifications WHERE product_id=68 AND parameter_id=p.id AND qc_type='LP');

INSERT IGNORE INTO qc_specifications (product_id, qc_type, parameter_id, method_id, standard_value, min_value, max_value, uom)
SELECT 68, 'LP', p.id, m.id, 'Colorless to pale yellow', NULL, NULL, '-'
FROM qc_parameters p, qc_methods m WHERE p.name='Color' AND m.name='Visual Inspection'
AND NOT EXISTS (SELECT 1 FROM qc_specifications WHERE product_id=68 AND parameter_id=p.id AND qc_type='LP');

SELECT 'QC Specs (Pellicle)' AS module, COUNT(*) AS total FROM qc_specifications WHERE product_id = 68;

-- 4. Verify existing data untouched
SELECT 'Existing WOs' AS check_item, COUNT(*) AS count FROM work_orders;
SELECT 'Existing MPS' AS check_item, COUNT(*) AS count FROM mps_headers;
SELECT 'Existing FPAs' AS check_item, COUNT(*) AS count FROM qc_analysis_requests;
SELECT 'Existing Products' AS check_item, COUNT(*) AS count FROM products;

SELECT 'LIVE MIGRATION COMPLETE - ALL SAFE' AS result;
