-- Export ALL BOM details from DEV for restore to LIVE
-- BOM 2 (Cylo Bind @2.5 gal) and BOM 3 (Cylo Plus @200 ltr) lost components

-- First check what dev has for BOM id=2 and BOM id=3
SELECT bh.id, bh.product_name, bd.raw_material_id, p.name AS comp_name, 
       bd.quantity, bd.unit_of_measure_id, bd.sequence
FROM bom_headers bh
JOIN bom_details bd ON bd.bom_header_id = bh.id
LEFT JOIN products p ON bd.raw_material_id = p.id
WHERE bh.id IN (2, 3)
ORDER BY bh.id, bd.sequence;
