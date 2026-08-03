-- Cleanup duplicate checkpoints and FPAs
SET @wo_id = (SELECT id FROM work_orders WHERE wo_number = 'WO-SIM-0601');

-- Keep only the latest mixing checkpoints and FPAs
DELETE FROM qc_analysis_results WHERE fpa_id IN (
  SELECT id FROM qc_analysis_requests WHERE fpa_number = 'FPA-SIM-MIX-001' AND id < (SELECT MAX(id) FROM (SELECT id FROM qc_analysis_requests WHERE fpa_number = 'FPA-SIM-MIX-001') t)
);
DELETE FROM qc_analysis_requests WHERE fpa_number = 'FPA-SIM-MIX-001' AND id < (SELECT MAX(id) FROM (SELECT id FROM qc_analysis_requests WHERE fpa_number = 'FPA-SIM-MIX-001') t);

-- Remove duplicate checkpoints
DELETE c FROM wo_qc_checkpoints c
WHERE c.wo_id = @wo_id AND c.process_stage = 'Mixing' 
AND c.id < (SELECT id FROM (SELECT MAX(id) as id FROM wo_qc_checkpoints WHERE wo_id = @wo_id AND process_stage = 'Mixing') t);

-- Verify clean state
SELECT process_stage, status, fpa_id FROM wo_qc_checkpoints WHERE wo_id = @wo_id ORDER BY id;
SELECT fpa_number, status, result FROM qc_analysis_requests WHERE fpa_number LIKE 'FPA-SIM%';

-- Full loop summary
SELECT 'MPS-SIM-202506' as step_id, 'Confirmed' as status
UNION ALL SELECT 'WO-SIM-0601', (SELECT status FROM work_orders WHERE wo_number='WO-SIM-0601')
UNION ALL SELECT 'Mixing CP', (SELECT status FROM wo_qc_checkpoints WHERE wo_id=@wo_id AND process_stage='Mixing' LIMIT 1)
UNION ALL SELECT 'Filling CP', (SELECT status FROM wo_qc_checkpoints WHERE wo_id=@wo_id AND process_stage='Filling' LIMIT 1)
UNION ALL SELECT 'Final QC CP', (SELECT status FROM wo_qc_checkpoints WHERE wo_id=@wo_id AND process_stage='Final QC' LIMIT 1);
