SELECT id, product_name, product_id, bom_code, qty, unit, version, status, process_type, source FROM bom_headers WHERE source='ERP' OR source IS NULL ORDER BY id;
SELECT id, bom_header_id, raw_material_id, item_code, item_description, quantity, unit, sequence FROM bom_details WHERE bom_header_id IN (SELECT id FROM bom_headers WHERE source='ERP' OR source IS NULL);
SELECT bom_code, product_name, qty, unit, process_type, production_line FROM bom_headers WHERE source='JBOX' LIMIT 5;
SELECT d.item_code, d.item_description, d.quantity, d.unit, d.use_tolerance, d.pct_tolerance, d.tolerance_value FROM bom_details d JOIN bom_headers h ON d.bom_header_id=h.id WHERE h.source='JBOX' LIMIT 10;
