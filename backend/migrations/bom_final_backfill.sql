-- Backfill any bom_details that have raw_material_id linked but missing item_description or item_code
UPDATE bom_details bd
JOIN products p ON bd.raw_material_id = p.id
SET bd.item_description = COALESCE(bd.item_description, p.name),
    bd.item_code = COALESCE(bd.item_code, p.sku)
WHERE (bd.item_description IS NULL OR bd.item_code IS NULL) AND bd.raw_material_id > 0;

-- Also backfill unit from uom if still null
UPDATE bom_details bd
JOIN uom u ON bd.unit_of_measure_id = u.id
SET bd.unit = u.code
WHERE bd.unit IS NULL AND bd.unit_of_measure_id IS NOT NULL;

-- Verify no empty descriptions left
SELECT COUNT(*) as empty_desc FROM bom_details WHERE (item_description IS NULL OR item_description = '') AND raw_material_id > 0;
SELECT COUNT(*) as empty_code FROM bom_details WHERE (item_code IS NULL OR item_code = '') AND raw_material_id > 0;
