-- SAFE: Add missing columns to qc_specifications on LIVE
-- Uses IF NOT EXISTS pattern via ALTER TABLE + IGNORE errors

ALTER TABLE qc_specifications ADD COLUMN qc_type VARCHAR(30) DEFAULT 'Incoming' AFTER product_id;
ALTER TABLE qc_specifications ADD COLUMN uom VARCHAR(50) AFTER max_value;
ALTER TABLE qc_specifications ADD COLUMN is_required TINYINT DEFAULT 1 AFTER uom;

-- Now insert QC Specs for Pellicle (product_id=68)
INSERT IGNORE INTO qc_specifications (product_id, qc_type, parameter_id, method_id, standard_value, min_value, max_value, uom)
SELECT 68, 'LP', p.id, m.id, '5000', 4500, 5500, 'cPs'
FROM qc_parameters p, qc_methods m WHERE p.name='Viscosity' AND m.name='Viscometer Brookfield'
AND NOT EXISTS (SELECT 1 FROM qc_specifications WHERE product_id=68 AND parameter_id=p.id);

INSERT IGNORE INTO qc_specifications (product_id, qc_type, parameter_id, method_id, standard_value, min_value, max_value, uom)
SELECT 68, 'LP', p.id, m.id, '7.0', 6.5, 7.5, 'pH'
FROM qc_parameters p, qc_methods m WHERE p.name='pH Level' AND m.name='pH Meter Digital'
AND NOT EXISTS (SELECT 1 FROM qc_specifications WHERE product_id=68 AND parameter_id=p.id);

INSERT IGNORE INTO qc_specifications (product_id, qc_type, parameter_id, method_id, standard_value, min_value, max_value, uom)
SELECT 68, 'LP', p.id, m.id, '1.05', 1.03, 1.07, 'g/cm3'
FROM qc_parameters p, qc_methods m WHERE p.name='Specific Gravity' AND m.name='Hydrometer'
AND NOT EXISTS (SELECT 1 FROM qc_specifications WHERE product_id=68 AND parameter_id=p.id);

INSERT IGNORE INTO qc_specifications (product_id, qc_type, parameter_id, method_id, standard_value, min_value, max_value, uom)
SELECT 68, 'LP', p.id, m.id, 'Clear gel', NULL, NULL, '-'
FROM qc_parameters p, qc_methods m WHERE p.name='Appearance' AND m.name='Visual Inspection'
AND NOT EXISTS (SELECT 1 FROM qc_specifications WHERE product_id=68 AND parameter_id=p.id);

INSERT IGNORE INTO qc_specifications (product_id, qc_type, parameter_id, method_id, standard_value, min_value, max_value, uom)
SELECT 68, 'LP', p.id, m.id, '2.5', 2.3, 2.7, '%'
FROM qc_parameters p, qc_methods m WHERE p.name='Active Content' AND m.name='Titration'
AND NOT EXISTS (SELECT 1 FROM qc_specifications WHERE product_id=68 AND parameter_id=p.id);

INSERT IGNORE INTO qc_specifications (product_id, qc_type, parameter_id, method_id, standard_value, min_value, max_value, uom)
SELECT 68, 'LP', p.id, m.id, 'Colorless to pale yellow', NULL, NULL, '-'
FROM qc_parameters p, qc_methods m WHERE p.name='Color' AND m.name='Visual Inspection'
AND NOT EXISTS (SELECT 1 FROM qc_specifications WHERE product_id=68 AND parameter_id=p.id);

-- Verification
SELECT 'QC Specs (Pellicle)' AS module, COUNT(*) AS total FROM qc_specifications WHERE product_id = 68;
SELECT 'Existing WOs' AS check_item, COUNT(*) AS count FROM work_orders;
SELECT 'Existing Products' AS check_item, COUNT(*) AS count FROM products;
SELECT 'LIVE SPECS MIGRATION COMPLETE' AS result;
