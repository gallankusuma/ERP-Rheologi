-- =====================================================
-- E2E PRODUCTION LOOP SIMULATION
-- Database: erp_rheologi_dev
-- =====================================================
-- Flow: PPIC(MPS) → WO → Production Planning → QC
-- =====================================================

SET FOREIGN_KEY_CHECKS=0;

-- =====================================================
-- STEP 0: CLEANUP old simulation data
-- =====================================================
DELETE FROM qc_analysis_results WHERE fpa_id IN (SELECT id FROM qc_analysis_requests WHERE fpa_number LIKE 'FPA-SIM%');
DELETE FROM qc_analysis_requests WHERE fpa_number LIKE 'FPA-SIM%';
DELETE FROM wo_qc_checkpoints WHERE wo_id IN (SELECT id FROM work_orders WHERE wo_number LIKE 'WO-SIM%');
DELETE FROM wo_process_logs WHERE wo_id IN (SELECT id FROM work_orders WHERE wo_number LIKE 'WO-SIM%');
DELETE FROM wo_results WHERE wo_id IN (SELECT id FROM work_orders WHERE wo_number LIKE 'WO-SIM%');
DELETE FROM work_orders WHERE wo_number LIKE 'WO-SIM%';
DELETE FROM mps_week_data WHERE mps_detail_id IN (SELECT id FROM mps_details WHERE mps_header_id IN (SELECT id FROM mps_headers WHERE mps_number LIKE 'MPS-SIM%'));
DELETE FROM mps_details WHERE mps_header_id IN (SELECT id FROM mps_headers WHERE mps_number LIKE 'MPS-SIM%');
DELETE FROM mps_headers WHERE mps_number LIKE 'MPS-SIM%';
DELETE FROM qc_specifications WHERE product_id = 68;
DELETE FROM qc_methods WHERE name IN ('Viscometer Brookfield', 'pH Meter Digital', 'Hydrometer', 'Visual Inspection', 'Titration');
DELETE FROM qc_parameters WHERE name IN ('Viscosity', 'pH Level', 'Specific Gravity', 'Appearance', 'Active Content', 'Color');

SELECT '✅ STEP 0: Cleanup complete' AS status;

-- =====================================================
-- STEP 1: QC MASTER DATA SETUP
-- =====================================================

-- 1a. QC Methods
INSERT INTO qc_methods (name, description) VALUES
('Viscometer Brookfield', 'Pengukuran viskositas menggunakan Viscometer Brookfield RVT'),
('pH Meter Digital', 'Pengukuran pH menggunakan pH Meter Hanna HI98190'),
('Hydrometer', 'Pengukuran berat jenis dengan Hydrometer ASTM'),
('Visual Inspection', 'Pemeriksaan visual secara langsung'),
('Titration', 'Titrasi untuk penentuan kadar aktif');

SELECT '✅ STEP 1a: QC Methods created' AS status;

-- 1b. QC Parameters
INSERT INTO qc_parameters (name, description) VALUES
('Viscosity', 'Kekentalan produk dalam cPs'),
('pH Level', 'Tingkat keasaman/kebasaan'),
('Specific Gravity', 'Berat jenis relatif terhadap air'),
('Appearance', 'Tampilan visual produk'),
('Active Content', 'Kadar bahan aktif dalam %'),
('Color', 'Warna produk');

SELECT '✅ STEP 1b: QC Parameters created' AS status;

-- 1c. QC Specifications for Product ID 68 (Pellicle)
INSERT INTO qc_specifications (product_id, qc_type, parameter_id, method_id, standard_value, min_value, max_value, uom) VALUES
(68, 'LP', (SELECT id FROM qc_parameters WHERE name='Viscosity'), (SELECT id FROM qc_methods WHERE name='Viscometer Brookfield'), '5000', 4500.0000, 5500.0000, 'cPs'),
(68, 'LP', (SELECT id FROM qc_parameters WHERE name='pH Level'), (SELECT id FROM qc_methods WHERE name='pH Meter Digital'), '7.0', 6.5000, 7.5000, 'pH'),
(68, 'LP', (SELECT id FROM qc_parameters WHERE name='Specific Gravity'), (SELECT id FROM qc_methods WHERE name='Hydrometer'), '1.05', 1.0300, 1.0700, 'g/cm³'),
(68, 'LP', (SELECT id FROM qc_parameters WHERE name='Appearance'), (SELECT id FROM qc_methods WHERE name='Visual Inspection'), 'Clear gel', NULL, NULL, '-'),
(68, 'LP', (SELECT id FROM qc_parameters WHERE name='Active Content'), (SELECT id FROM qc_methods WHERE name='Titration'), '2.5', 2.3000, 2.7000, '%'),
(68, 'LP', (SELECT id FROM qc_parameters WHERE name='Color'), (SELECT id FROM qc_methods WHERE name='Visual Inspection'), 'Colorless to pale yellow', NULL, NULL, '-');

SELECT '✅ STEP 1c: QC Specs for Pellicle (6 params) created' AS status;

-- =====================================================
-- STEP 2: PPIC — Create MPS
-- =====================================================
INSERT INTO mps_headers (mps_number, period_year, period_month, scheme, status, created_by)
VALUES ('MPS-SIM-202506', 2026, 6, 'MTO', 'Confirmed', 1);

SET @mps_id = LAST_INSERT_ID();

-- MPS Detail for Pellicle (product_id=68)
INSERT INTO mps_details (mps_header_id, product_id, demand_qty, beginning_inv, current_stock, batch_no, batch_qty, lead_time_weeks, status)
VALUES (@mps_id, 68, 2000, 100, 100, 'BATCH-PEL-0601', 2000, 2, 'In Production');

SET @mps_detail_id = LAST_INSERT_ID();

-- Weekly data for June 2026 (Week 23-26)
INSERT INTO mps_week_data (mps_detail_id, week_number, year, forecast_qty, so_qty, start_process_qty, fg_qty) VALUES
(@mps_detail_id, 23, 2026, 500, 500, 500, 0),
(@mps_detail_id, 24, 2026, 500, 500, 500, 400),
(@mps_detail_id, 25, 2026, 500, 500, 500, 500),
(@mps_detail_id, 26, 2026, 500, 500, 500, 600);

SELECT '✅ STEP 2: MPS created (MPS-SIM-202506) + 4 weeks' AS status;

-- =====================================================
-- STEP 3: Generate Work Order from MPS
-- =====================================================
INSERT INTO work_orders (wo_number, product_id, quantity, status, priority, scheduled_start, scheduled_end, created_by, mps_detail_id)
VALUES ('WO-SIM-0601', 68, 2000, 'in_progress', 'high', '2026-06-01', '2026-06-28', 1, @mps_detail_id);

SET @wo_id = LAST_INSERT_ID();

-- Link WO back to MPS detail
UPDATE mps_details SET wo_id = @wo_id WHERE id = @mps_detail_id;

SELECT '✅ STEP 3: WO created (WO-SIM-0601) linked to MPS' AS status;

-- =====================================================
-- STEP 4: Production Process Logs (simulate execution)
-- =====================================================
INSERT INTO wo_process_logs (wo_id, process_name, start_time, end_time, duration_minutes, status, recorded_by) VALUES
(@wo_id, 'Mixing', '2026-06-02 08:00:00', '2026-06-03 17:00:00', 1620, 'completed', 1),
(@wo_id, 'Aging', '2026-06-04 08:00:00', '2026-06-05 17:00:00', 1080, 'completed', 1),
(@wo_id, 'Filling', '2026-06-06 08:00:00', NULL, NULL, 'in_progress', 1);

SELECT '✅ STEP 4: Process logs created (Mixing✅, Aging✅, Filling🔄)' AS status;

-- =====================================================
-- STEP 5: QC Checkpoints + Auto FPA
-- =====================================================

-- Checkpoint 1: Mixing (PASSED)
INSERT INTO wo_qc_checkpoints (wo_id, process_stage, is_mandatory, qc_type, status) 
VALUES (@wo_id, 'Mixing', 1, 'LP', 'passed');
SET @cp1 = LAST_INSERT_ID();

-- FPA for Mixing (approved)
INSERT INTO qc_analysis_requests (fpa_number, type, reference_id, reference_number, product_id, notes, created_by, status, result)
VALUES ('FPA-SIM-MIX-001', 'LP', @wo_id, 'WO-SIM-0601', 68, 'In-Process QC for Mixing | WO: WO-SIM-0601', 1, 'Approved', 'Pass');
SET @fpa_mix = LAST_INSERT_ID();
UPDATE wo_qc_checkpoints SET fpa_id = @fpa_mix, triggered_at = '2026-06-03 10:00:00', resolved_at = '2026-06-03 15:00:00' WHERE id = @cp1;

-- FPA Results for Mixing (all passed)
INSERT INTO qc_analysis_results (fpa_id, parameter_id, method_id, standard_value, min_value, max_value, actual_value, is_pass, tested_by, tested_at) VALUES
(@fpa_mix, (SELECT id FROM qc_parameters WHERE name='Viscosity'), (SELECT id FROM qc_methods WHERE name='Viscometer Brookfield'), '5000', 4500, 5500, '5120', 1, 1, '2026-06-03 11:00:00'),
(@fpa_mix, (SELECT id FROM qc_parameters WHERE name='pH Level'), (SELECT id FROM qc_methods WHERE name='pH Meter Digital'), '7.0', 6.5, 7.5, '6.98', 1, 1, '2026-06-03 11:30:00'),
(@fpa_mix, (SELECT id FROM qc_parameters WHERE name='Specific Gravity'), (SELECT id FROM qc_methods WHERE name='Hydrometer'), '1.05', 1.03, 1.07, '1.052', 1, 1, '2026-06-03 12:00:00'),
(@fpa_mix, (SELECT id FROM qc_parameters WHERE name='Appearance'), (SELECT id FROM qc_methods WHERE name='Visual Inspection'), 'Clear gel', NULL, NULL, 'Clear gel, no particles', 1, 1, '2026-06-03 12:15:00'),
(@fpa_mix, (SELECT id FROM qc_parameters WHERE name='Active Content'), (SELECT id FROM qc_methods WHERE name='Titration'), '2.5', 2.3, 2.7, '2.48', 1, 1, '2026-06-03 13:00:00'),
(@fpa_mix, (SELECT id FROM qc_parameters WHERE name='Color'), (SELECT id FROM qc_methods WHERE name='Visual Inspection'), 'Colorless to pale yellow', NULL, NULL, 'Colorless', 1, 1, '2026-06-03 13:15:00');

SELECT '✅ STEP 5a: Mixing checkpoint PASSED (6/6 params pass)' AS status;

-- Checkpoint 2: Filling (IN_REVIEW — waiting for QC results)
INSERT INTO wo_qc_checkpoints (wo_id, process_stage, is_mandatory, qc_type, status)
VALUES (@wo_id, 'Filling', 1, 'LP', 'in_review');
SET @cp2 = LAST_INSERT_ID();

-- FPA for Filling (pending review)
INSERT INTO qc_analysis_requests (fpa_number, type, reference_id, reference_number, product_id, notes, created_by, status)
VALUES ('FPA-SIM-FILL-001', 'LP', @wo_id, 'WO-SIM-0601', 68, 'In-Process QC for Filling | WO: WO-SIM-0601', 1, 'Pending');
SET @fpa_fill = LAST_INSERT_ID();
UPDATE wo_qc_checkpoints SET fpa_id = @fpa_fill, triggered_at = '2026-06-06 14:00:00' WHERE id = @cp2;

-- FPA Results for Filling (partially filled — simulating in-progress QC)
INSERT INTO qc_analysis_results (fpa_id, parameter_id, method_id, standard_value, min_value, max_value, actual_value, is_pass, tested_by, tested_at) VALUES
(@fpa_fill, (SELECT id FROM qc_parameters WHERE name='Viscosity'), (SELECT id FROM qc_methods WHERE name='Viscometer Brookfield'), '5000', 4500, 5500, '4980', 1, 1, '2026-06-06 15:00:00'),
(@fpa_fill, (SELECT id FROM qc_parameters WHERE name='pH Level'), (SELECT id FROM qc_methods WHERE name='pH Meter Digital'), '7.0', 6.5, 7.5, '7.12', 1, 1, '2026-06-06 15:30:00'),
(@fpa_fill, (SELECT id FROM qc_parameters WHERE name='Specific Gravity'), (SELECT id FROM qc_methods WHERE name='Hydrometer'), '1.05', 1.03, 1.07, NULL, 0, NULL, NULL),
(@fpa_fill, (SELECT id FROM qc_parameters WHERE name='Appearance'), (SELECT id FROM qc_methods WHERE name='Visual Inspection'), 'Clear gel', NULL, NULL, NULL, 0, NULL, NULL),
(@fpa_fill, (SELECT id FROM qc_parameters WHERE name='Active Content'), (SELECT id FROM qc_methods WHERE name='Titration'), '2.5', 2.3, 2.7, NULL, 0, NULL, NULL),
(@fpa_fill, (SELECT id FROM qc_parameters WHERE name='Color'), (SELECT id FROM qc_methods WHERE name='Visual Inspection'), 'Colorless to pale yellow', NULL, NULL, NULL, 0, NULL, NULL);

SELECT '✅ STEP 5b: Filling checkpoint IN_REVIEW (2/6 tested)' AS status;

-- Checkpoint 3: Final QC (PENDING — not started)
INSERT INTO wo_qc_checkpoints (wo_id, process_stage, is_mandatory, qc_type, status)
VALUES (@wo_id, 'Final QC', 1, 'LP', 'pending');

SELECT '✅ STEP 5c: Final QC checkpoint PENDING (not started)' AS status;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
SELECT '========== VERIFICATION ==========' AS section;

SELECT 'MPS' AS module, mps_number, period_year, period_month, status FROM mps_headers WHERE mps_number LIKE 'MPS-SIM%';

SELECT 'MPS Weekly' AS module, w.week_number, w.forecast_qty, w.so_qty, w.start_process_qty, w.fg_qty 
FROM mps_week_data w JOIN mps_details d ON w.mps_detail_id = d.id 
WHERE d.mps_header_id = @mps_id ORDER BY w.week_number;

SELECT 'Work Order' AS module, wo_number, quantity, status, priority, scheduled_start, scheduled_end FROM work_orders WHERE wo_number LIKE 'WO-SIM%';

SELECT 'Process Logs' AS module, process_name, status, duration_minutes FROM wo_process_logs WHERE wo_id = @wo_id ORDER BY id;

SELECT 'QC Checkpoints' AS module, process_stage, status, fpa_id FROM wo_qc_checkpoints WHERE wo_id = @wo_id ORDER BY id;

SELECT 'FPA Requests' AS module, fpa_number, status, result FROM qc_analysis_requests WHERE fpa_number LIKE 'FPA-SIM%' ORDER BY id;

SELECT 'QC Methods' AS module, COUNT(*) as count FROM qc_methods;
SELECT 'QC Parameters' AS module, COUNT(*) as count FROM qc_parameters;
SELECT 'QC Specs (Pellicle)' AS module, COUNT(*) as count FROM qc_specifications WHERE product_id = 68;
SELECT 'FPA Results (Mix)' AS module, COUNT(*) as total, SUM(is_pass) as passed FROM qc_analysis_results WHERE fpa_id = @fpa_mix;
SELECT 'FPA Results (Fill)' AS module, COUNT(*) as total, SUM(CASE WHEN actual_value IS NOT NULL THEN 1 ELSE 0 END) as tested FROM qc_analysis_results WHERE fpa_id = @fpa_fill;

SELECT '✅ E2E SIMULATION COMPLETE' AS status;

SET FOREIGN_KEY_CHECKS=1;
