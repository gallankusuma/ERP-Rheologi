-- Fix the 1 bad row: set unit to Pcs (it's a label sticker, so piece)
UPDATE bom_details SET unit = 'Pcs', unit_of_measure_id = 3 WHERE unit = 'Label Sticker Botol Nobas 400 EC @ 400 ml';

-- Consolidate LTR -> L (remove duplicate, use existing L id=2)
UPDATE bom_details SET unit_of_measure_id = 2 WHERE unit_of_measure_id = 25;
UPDATE products SET unit_of_measure_id = 2 WHERE unit_of_measure_id = 25;
DELETE FROM uom WHERE id = 25;

-- Standardize gr -> GR in uom master
UPDATE uom SET code = 'GR' WHERE id = 13 AND code = 'gr';

-- Verify final state
SELECT 
  SUM(CASE WHEN unit_of_measure_id IS NOT NULL THEN 1 ELSE 0 END) as linked,
  SUM(CASE WHEN unit_of_measure_id IS NULL THEN 1 ELSE 0 END) as not_linked
FROM bom_details;

SELECT id, code, name FROM uom ORDER BY code;
