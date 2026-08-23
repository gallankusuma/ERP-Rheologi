DELETE FROM qc_analysis_results;
DELETE FROM qc_analysis_requests;
DELETE FROM wo_qc_checkpoints;
DELETE FROM wo_process_logs;
SELECT 'DONE - all QC/FPA/process logs cleared' AS status;
