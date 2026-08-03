SELECT 'qc_methods' as tbl, COUNT(*) as cnt FROM qc_methods
UNION ALL SELECT 'qc_parameters', COUNT(*) FROM qc_parameters
UNION ALL SELECT 'qc_specifications', COUNT(*) FROM qc_specifications
UNION ALL SELECT 'qc_instruments', COUNT(*) FROM qc_instruments
UNION ALL SELECT 'qc_sampling_plans', COUNT(*) FROM qc_sampling_plans
UNION ALL SELECT 'qc_sampling_areas', COUNT(*) FROM qc_sampling_areas;
