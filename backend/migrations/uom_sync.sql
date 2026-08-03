-- ===== STEP 1: Create missing UoM entries =====
INSERT IGNORE INTO uom (code, name) VALUES ('ROLL', 'Roll');
INSERT IGNORE INTO uom (code, name) VALUES ('LTR', 'Litre');

-- ===== STEP 2: Link bom_details.unit_of_measure_id based on unit text =====

-- Exact case-insensitive matches
UPDATE bom_details SET unit_of_measure_id = 3 WHERE UPPER(TRIM(unit)) = 'PCS' AND (unit_of_measure_id IS NULL);
UPDATE bom_details SET unit_of_measure_id = 1 WHERE UPPER(TRIM(unit)) IN ('KG', 'KGS') AND (unit_of_measure_id IS NULL);
UPDATE bom_details SET unit_of_measure_id = 13 WHERE UPPER(TRIM(unit)) IN ('GR', 'GRAM') AND (unit_of_measure_id IS NULL);
UPDATE bom_details SET unit_of_measure_id = 23 WHERE UPPER(TRIM(unit)) = 'SET' AND (unit_of_measure_id IS NULL);

-- Litre variants -> L (id=2)
UPDATE bom_details SET unit_of_measure_id = 2 WHERE UPPER(TRIM(unit)) IN ('LTR', 'L', 'LITER', 'LITRE') AND (unit_of_measure_id IS NULL);

-- Roll -> new ROLL entry
UPDATE bom_details bd 
JOIN uom u ON u.code = 'ROLL' 
SET bd.unit_of_measure_id = u.id 
WHERE UPPER(TRIM(bd.unit)) = 'ROLL' AND bd.unit_of_measure_id IS NULL;

-- ===== STEP 3: Also standardize the unit text field =====
UPDATE bom_details SET unit = 'Pcs' WHERE UPPER(TRIM(unit)) = 'PCS';
UPDATE bom_details SET unit = 'Kg' WHERE UPPER(TRIM(unit)) IN ('KG', 'KGS');
UPDATE bom_details SET unit = 'Gr' WHERE UPPER(TRIM(unit)) IN ('GR', 'GRAM');
UPDATE bom_details SET unit = 'Ltr' WHERE UPPER(TRIM(unit)) IN ('LTR', 'L', 'LITER', 'LITRE');
UPDATE bom_details SET unit = 'Set' WHERE UPPER(TRIM(unit)) = 'SET';
UPDATE bom_details SET unit = 'Roll' WHERE UPPER(TRIM(unit)) = 'ROLL';

-- ===== STEP 4: Also link products.unit_of_measure_id for newly created products =====
UPDATE products p
JOIN bom_details bd ON p.sku = bd.item_code AND bd.unit_of_measure_id IS NOT NULL
SET p.unit_of_measure_id = bd.unit_of_measure_id
WHERE p.unit_of_measure_id IS NULL;

-- ===== VERIFICATION =====
SELECT 
  COUNT(*) as total_details,
  SUM(CASE WHEN unit_of_measure_id IS NOT NULL THEN 1 ELSE 0 END) as has_uom_id,
  SUM(CASE WHEN unit_of_measure_id IS NULL THEN 1 ELSE 0 END) as still_missing
FROM bom_details;

-- Check remaining unlinked units
SELECT DISTINCT bd.unit, COUNT(*) as cnt 
FROM bom_details bd 
WHERE bd.unit_of_measure_id IS NULL AND bd.unit IS NOT NULL AND bd.unit != ''
GROUP BY bd.unit
ORDER BY cnt DESC;

-- Updated UoM master
SELECT id, code, name FROM uom ORDER BY code;

-- Products with UoM linked
SELECT COUNT(*) as products_with_uom FROM products WHERE unit_of_measure_id IS NOT NULL;
