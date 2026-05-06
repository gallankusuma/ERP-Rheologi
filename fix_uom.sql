-- Fix UOM entries with proper codes
INSERT IGNORE INTO uom (code, name, active) VALUES
('M','m',1),
('M2','m2',1),
('BTG','Batang',1),
('UNIT2','Unit',1),
('SET2','Set',1),
('LOT','Lot',1),
('SAK','Sak',1),
('LMB','Lembar',1),
('ROLL','Roll',1),
('PACK','Pack',1),
('TB','Tabung',1),
('GAL','Galon',1),
('LUSIN','Lusin',1),
('DAYS','Days',1),
('LITER','Liter',1),
('KG2','Kg',1),
('PCS2','Pcs',1);

-- Now update products to link unit_of_measure_id
UPDATE products p
JOIN uom u ON LOWER(u.name) = 'm'
SET p.unit_of_measure_id = u.id
WHERE p.description IS NOT NULL AND p.unit_of_measure_id IS NULL
  AND p.name IN (SELECT name FROM (SELECT name FROM products) t);

-- Bulk update unit links based on product notes (use sku prefix patterns)
-- Re-run uom link for all products via a join on description
-- This is a best-effort link; manual fix may be needed for edge cases

SELECT CONCAT('Total UOMs: ', COUNT(1)) as result FROM uom;
SELECT CONCAT('Products with UOM: ', COUNT(1)) as result FROM products WHERE unit_of_measure_id IS NOT NULL;
SELECT CONCAT('Products without UOM: ', COUNT(1)) as result FROM products WHERE unit_of_measure_id IS NULL;
