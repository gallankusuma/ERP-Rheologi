-- Backfill existing ERP bom_details with product name/sku and unit code
UPDATE bom_details bd
JOIN products p ON bd.raw_material_id = p.id
SET bd.item_description = p.name, bd.item_code = p.sku
WHERE bd.item_description IS NULL AND bd.raw_material_id > 0;

UPDATE bom_details bd
JOIN uom u ON bd.unit_of_measure_id = u.id
SET bd.unit = u.code
WHERE bd.unit IS NULL AND bd.unit_of_measure_id IS NOT NULL;

-- Verify
SELECT bd.id, bd.bom_header_id, bd.item_code, bd.item_description, bd.quantity, bd.unit 
FROM bom_details bd 
JOIN bom_headers bh ON bd.bom_header_id = bh.id 
WHERE bh.source = 'ERP' OR bh.source IS NULL
LIMIT 15;
