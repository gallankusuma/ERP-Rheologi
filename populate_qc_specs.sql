-- Populate qc_specifications from scraped FBox data
-- Maps: rnd_spec items → products, rnd_spec parameters → qc_parameters/methods

-- First see what we can map
-- Show how many spec items have matching products
SELECT 'Items with matching products' as info, COUNT(DISTINCT si.id) as cnt
FROM rnd_spec_items si
INNER JOIN products p ON si.item_code COLLATE utf8mb4_unicode_ci = p.sku COLLATE utf8mb4_unicode_ci;

-- Insert into qc_specifications for each product+parameter+method combination
-- We join: rnd_spec_items → products, rnd_spec_parameters → qc_parameters, qc_methods
INSERT IGNORE INTO qc_specifications (product_id, qc_type, parameter_id, method_id, standard_value, min_value, max_value, uom)
SELECT DISTINCT
  p.id as product_id,
  CASE 
    WHEN rs.process_type LIKE '%Incoming%' THEN 'Incoming'
    WHEN rs.sample_type_code = 'FG' THEN 'FG'
    WHEN rs.sample_type_code = 'IM-FG' THEN 'LP'
    WHEN rs.sample_type_code = 'IM' THEN 'LP'
    ELSE 'LP'
  END as qc_type,
  qp.id as parameter_id,
  qm.id as method_id,
  rp.specification as standard_value,
  CASE 
    WHEN rp.specification REGEXP '^[0-9.]+ *- *[0-9.]+$' 
      THEN CAST(SUBSTRING_INDEX(rp.specification, '-', 1) AS DECIMAL(10,4))
    WHEN rp.specification REGEXP '^[Mm]in *[0-9.]+'
      THEN CAST(REGEXP_SUBSTR(rp.specification, '[0-9.]+') AS DECIMAL(10,4))
    ELSE NULL
  END as min_value,
  CASE 
    WHEN rp.specification REGEXP '^[0-9.]+ *- *[0-9.]+$' 
      THEN CAST(SUBSTRING_INDEX(rp.specification, '-', -1) AS DECIMAL(10,4))
    WHEN rp.specification REGEXP '^[Mm]ax *[0-9.]+'
      THEN CAST(REGEXP_SUBSTR(rp.specification, '[0-9.]+') AS DECIMAL(10,4))
    ELSE NULL
  END as max_value,
  rp.unit as uom
FROM rnd_spec_parameters rp
INNER JOIN rnd_spec_samples ss ON rp.sample_id = ss.id
INNER JOIN rnd_specifications rs ON ss.spec_id = rs.id
INNER JOIN rnd_spec_items si ON si.spec_id = rs.id
INNER JOIN products p ON si.item_code COLLATE utf8mb4_unicode_ci = p.sku COLLATE utf8mb4_unicode_ci
INNER JOIN qc_parameters qp ON rp.parameter_name COLLATE utf8mb4_unicode_ci = qp.name COLLATE utf8mb4_unicode_ci
LEFT JOIN qc_methods qm ON rp.method COLLATE utf8mb4_unicode_ci = qm.name COLLATE utf8mb4_unicode_ci
WHERE rp.parameter_name IS NOT NULL AND rp.parameter_name != '';

-- Show results
SELECT 'Total qc_specifications after import' as info, COUNT(*) as cnt FROM qc_specifications;

-- Show breakdown by qc_type
SELECT qc_type, COUNT(*) as cnt FROM qc_specifications GROUP BY qc_type ORDER BY cnt DESC;
