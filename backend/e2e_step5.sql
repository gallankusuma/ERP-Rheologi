-- E2E Step 5: QC Checkpoints + FPA (FIXED)
SET FOREIGN_KEY_CHECKS=0;

SET @wo_id = (SELECT id FROM work_orders WHERE wo_number = 'WO-SIM-0601');

-- Checkpoint 1: Mixing (PASSED)
INSERT INTO wo_qc_checkpoints (wo_id, process_stage, is_mandatory, qc_type, status) 
VALUES (@wo_id, 'Mixing', 1, 'LP', 'passed');
SET @cp1 = LAST_INSERT_ID();

INSERT INTO qc_analysis_requests (fpa_number, type, reference_id, reference_number, product_id, notes, created_by, status, result)
VALUES ('FPA-SIM-MIX-001', 'LP', @wo_id, 'WO-SIM-0601', 68, 'In-Process QC for Mixing | WO: WO-SIM-0601', 1, 'Approved', 'Pass');
SET @fpa_mix = LAST_INSERT_ID();

UPDATE wo_qc_checkpoints SET fpa_id = @fpa_mix, triggered_at = '2026-06-03 10:00:00', resolved_at = '2026-06-03 15:00:00' WHERE id = @cp1;

-- Params & Methods lookup
SET @param_visc = (SELECT id FROM qc_parameters WHERE name='Viscosity' LIMIT 1);
SET @param_ph = (SELECT id FROM qc_parameters WHERE name='pH Level' LIMIT 1);
SET @param_sg = (SELECT id FROM qc_parameters WHERE name='Specific Gravity' LIMIT 1);
SET @param_app = (SELECT id FROM qc_parameters WHERE name='Appearance' LIMIT 1);
SET @param_act = (SELECT id FROM qc_parameters WHERE name='Active Content' LIMIT 1);
SET @param_col = (SELECT id FROM qc_parameters WHERE name='Color' LIMIT 1);

SET @meth_visc = (SELECT id FROM qc_methods WHERE name='Viscometer Brookfield' LIMIT 1);
SET @meth_ph = (SELECT id FROM qc_methods WHERE name='pH Meter Digital' LIMIT 1);
SET @meth_hydro = (SELECT id FROM qc_methods WHERE name='Hydrometer' LIMIT 1);
SET @meth_visual = (SELECT id FROM qc_methods WHERE name='Visual Inspection' LIMIT 1);
SET @meth_titr = (SELECT id FROM qc_methods WHERE name='Titration' LIMIT 1);

-- Mixing FPA Results (all passed)
INSERT INTO qc_analysis_results (fpa_id, parameter_id, method_id, standard_value, min_value, max_value, actual_value, is_pass) VALUES
(@fpa_mix, @param_visc, @meth_visc, '5000', '4500', '5500', '5120', 1),
(@fpa_mix, @param_ph, @meth_ph, '7.0', '6.5', '7.5', '6.98', 1),
(@fpa_mix, @param_sg, @meth_hydro, '1.05', '1.03', '1.07', '1.052', 1),
(@fpa_mix, @param_app, @meth_visual, 'Clear gel', NULL, NULL, 'Clear gel, no particles', 1),
(@fpa_mix, @param_act, @meth_titr, '2.5', '2.3', '2.7', '2.48', 1),
(@fpa_mix, @param_col, @meth_visual, 'Colorless to pale yellow', NULL, NULL, 'Colorless', 1);

-- Checkpoint 2: Filling (IN_REVIEW)
INSERT INTO wo_qc_checkpoints (wo_id, process_stage, is_mandatory, qc_type, status)
VALUES (@wo_id, 'Filling', 1, 'LP', 'in_review');
SET @cp2 = LAST_INSERT_ID();

INSERT INTO qc_analysis_requests (fpa_number, type, reference_id, reference_number, product_id, notes, created_by, status)
VALUES ('FPA-SIM-FILL-001', 'LP', @wo_id, 'WO-SIM-0601', 68, 'In-Process QC for Filling | WO: WO-SIM-0601', 1, 'Pending');
SET @fpa_fill = LAST_INSERT_ID();

UPDATE wo_qc_checkpoints SET fpa_id = @fpa_fill, triggered_at = '2026-06-06 14:00:00' WHERE id = @cp2;

-- Filling FPA Results (2 tested, 4 pending)
INSERT INTO qc_analysis_results (fpa_id, parameter_id, method_id, standard_value, min_value, max_value, actual_value, is_pass) VALUES
(@fpa_fill, @param_visc, @meth_visc, '5000', '4500', '5500', '4980', 1),
(@fpa_fill, @param_ph, @meth_ph, '7.0', '6.5', '7.5', '7.12', 1),
(@fpa_fill, @param_sg, @meth_hydro, '1.05', '1.03', '1.07', NULL, 0),
(@fpa_fill, @param_app, @meth_visual, 'Clear gel', NULL, NULL, NULL, 0),
(@fpa_fill, @param_act, @meth_titr, '2.5', '2.3', '2.7', NULL, 0),
(@fpa_fill, @param_col, @meth_visual, 'Colorless to pale yellow', NULL, NULL, NULL, 0);

-- Checkpoint 3: Final QC (PENDING)
INSERT INTO wo_qc_checkpoints (wo_id, process_stage, is_mandatory, qc_type, status)
VALUES (@wo_id, 'Final QC', 1, 'LP', 'pending');

-- VERIFICATION
SELECT '=== QC CHECKPOINTS ===' AS info;
SELECT process_stage, status, fpa_id FROM wo_qc_checkpoints WHERE wo_id = @wo_id ORDER BY id;

SELECT '=== FPA REQUESTS ===' AS info;
SELECT fpa_number, status, result FROM qc_analysis_requests WHERE fpa_number LIKE 'FPA-SIM%' ORDER BY id;

SELECT '=== QC METHODS ===' AS info;
SELECT id, name FROM qc_methods ORDER BY id;

SELECT '=== QC PARAMETERS ===' AS info;
SELECT id, name FROM qc_parameters ORDER BY id;

SELECT '=== QC SPECS (Pellicle) ===' AS info;
SELECT s.id, p.name as parameter, m.name as method, s.standard_value, s.min_value, s.max_value, s.uom
FROM qc_specifications s
LEFT JOIN qc_parameters p ON s.parameter_id = p.id
LEFT JOIN qc_methods m ON s.method_id = m.id
WHERE s.product_id = 68;

SELECT '=== MIX FPA RESULTS (6/6 pass) ===' AS info;
SELECT p.name as parameter, r.actual_value, r.standard_value, r.is_pass
FROM qc_analysis_results r LEFT JOIN qc_parameters p ON r.parameter_id = p.id WHERE r.fpa_id = @fpa_mix;

SELECT '=== FILL FPA RESULTS (2/6 tested) ===' AS info;
SELECT p.name as parameter, r.actual_value, r.standard_value, r.is_pass
FROM qc_analysis_results r LEFT JOIN qc_parameters p ON r.parameter_id = p.id WHERE r.fpa_id = @fpa_fill;

SELECT '=== FULL LOOP SUMMARY ===' AS info;
SELECT 'MPS' as step, mps_number as id, status FROM mps_headers WHERE mps_number = 'MPS-SIM-202506'
UNION ALL
SELECT 'Work Order', wo_number, status FROM work_orders WHERE wo_number = 'WO-SIM-0601'
UNION ALL
SELECT 'QC-Mixing', 'FPA-SIM-MIX-001', (SELECT CONCAT(status,' / ', COALESCE(result,'')) FROM qc_analysis_requests WHERE fpa_number='FPA-SIM-MIX-001')
UNION ALL
SELECT 'QC-Filling', 'FPA-SIM-FILL-001', (SELECT CONCAT(status,' / ', COALESCE(result,'')) FROM qc_analysis_requests WHERE fpa_number='FPA-SIM-FILL-001');

SET FOREIGN_KEY_CHECKS=1;
