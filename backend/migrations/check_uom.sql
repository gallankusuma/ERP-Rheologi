-- Check current UoM master data
SELECT id, code, name FROM uom ORDER BY code;

-- Check unique units used in bom_details that aren't linked
SELECT DISTINCT bd.unit, COUNT(*) as cnt 
FROM bom_details bd 
WHERE bd.unit IS NOT NULL AND bd.unit != '' AND (bd.unit_of_measure_id IS NULL)
GROUP BY bd.unit
ORDER BY cnt DESC;

-- How many details have unit_of_measure_id linked?
SELECT 
  COUNT(*) as total_details,
  SUM(CASE WHEN unit_of_measure_id IS NOT NULL THEN 1 ELSE 0 END) as has_uom_id,
  SUM(CASE WHEN unit_of_measure_id IS NULL THEN 1 ELSE 0 END) as missing_uom_id
FROM bom_details;

-- Check units already matching uom.code
SELECT DISTINCT bd.unit, u.id as uom_id, u.code, u.name
FROM bom_details bd
JOIN uom u ON UPPER(TRIM(bd.unit)) = UPPER(TRIM(u.code))
WHERE bd.unit IS NOT NULL AND bd.unit != '' AND bd.unit_of_measure_id IS NULL
ORDER BY bd.unit;
