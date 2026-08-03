SELECT 'qc_parameters' AS tbl, COUNT(*) AS cnt FROM qc_parameters
UNION ALL SELECT 'qc_methods', COUNT(*) FROM qc_methods
UNION ALL SELECT 'qc_instruments', COUNT(*) FROM qc_instruments
UNION ALL SELECT 'qc_sampling_areas', COUNT(*) FROM qc_sampling_areas
UNION ALL SELECT 'qc_specifications', COUNT(*) FROM qc_specifications
UNION ALL SELECT 'qc_analysis_requests', COUNT(*) FROM qc_analysis_requests
UNION ALL SELECT 'qc_analysis_results', COUNT(*) FROM qc_analysis_results;

-- Check if tables exist
SHOW TABLES LIKE '%qc%';
