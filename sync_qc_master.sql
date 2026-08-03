-- Sync FBox spec methods/parameters into QC master data
-- Fix collation by using COLLATE

-- 1. Insert NEW methods that don't exist in qc_methods
INSERT INTO qc_methods (name, description)
SELECT DISTINCT p.method, 'Auto-imported from FBox specification data'
FROM rnd_spec_parameters p
WHERE p.method IS NOT NULL AND p.method != ''
AND p.method COLLATE utf8mb4_unicode_ci NOT IN (SELECT name COLLATE utf8mb4_unicode_ci FROM qc_methods)
GROUP BY p.method
ORDER BY p.method;

-- 2. Insert NEW parameters that don't exist in qc_parameters
INSERT INTO qc_parameters (name, description, param_type)
SELECT DISTINCT p.parameter_name, 'Auto-imported from FBox specification data',
  CASE 
    WHEN p.parameter_name LIKE '%Appearance%' THEN 'qualitative'
    WHEN p.parameter_name LIKE '%Color%' THEN 'qualitative'
    WHEN p.parameter_name LIKE '%Odor%' THEN 'qualitative'
    WHEN p.parameter_name LIKE '%Odour%' THEN 'qualitative'
    WHEN p.parameter_name LIKE '%Visual%' THEN 'qualitative'
    WHEN p.parameter_name LIKE '%Warna%' THEN 'qualitative'
    WHEN p.parameter_name LIKE '%Logo%' THEN 'qualitative'
    WHEN p.parameter_name LIKE '%Tulisan%' THEN 'qualitative'
    WHEN p.parameter_name LIKE '%Pictogram%' THEN 'qualitative'
    WHEN p.parameter_name LIKE '%Nama%' THEN 'qualitative'
    ELSE 'quantitative'
  END
FROM rnd_spec_parameters p
WHERE p.parameter_name IS NOT NULL AND p.parameter_name != ''
AND p.parameter_name COLLATE utf8mb4_unicode_ci NOT IN (SELECT name COLLATE utf8mb4_unicode_ci FROM qc_parameters)
GROUP BY p.parameter_name
ORDER BY p.parameter_name;

-- 3. Show final counts
SELECT 'qc_methods' as tbl, COUNT(*) as total FROM qc_methods
UNION ALL
SELECT 'qc_parameters' as tbl, COUNT(*) as total FROM qc_parameters;
