-- Check Cylo Plus BOM details on DEV
SELECT bh.id, bh.product_name, bd.id AS detail_id, bd.raw_material_id, 
       p.name AS component_name, bd.quantity, bd.unit_of_measure_id, u.name AS uom_name, bd.sequence
FROM bom_headers bh
JOIN bom_details bd ON bd.bom_header_id = bh.id
LEFT JOIN products p ON bd.raw_material_id = p.id
LEFT JOIN uom u ON bd.unit_of_measure_id = u.id
WHERE bh.product_name LIKE '%Cylo Plus%'
ORDER BY bh.id, bd.sequence;
