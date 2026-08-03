-- =====================================================
-- RESTORE BOM DETAILS on LIVE from DEV data
-- SAFE: Only INSERTs into empty bom_details for BOM 2 and 3
-- =====================================================

-- First verify BOM 2 and 3 have 0 components on live
SELECT bh.id, bh.product_name, COUNT(bd.id) AS existing_components
FROM bom_headers bh LEFT JOIN bom_details bd ON bd.bom_header_id = bh.id
WHERE bh.id IN (2, 3) GROUP BY bh.id;

-- BOM 2: Cylo Bind @2.5 gal (13 components from dev)
INSERT INTO bom_details (bom_header_id, raw_material_id, quantity, unit_of_measure_id, sequence) VALUES
(2, 68, 201.4000, 1, 1),
(2, 69, 0.8100, 1, 2),
(2, 71, 801.9200, 1, 3),
(2, 72, 0.8100, 1, 4),
(2, 73, 0.0500, 1, 5),
(2, 76, 2.0100, 1, 6),
(2, 81, 1.0000, 3, 7),
(2, 82, 1.0000, 3, 8),
(2, 107, 1.0000, 3, 9),
(2, 108, 1.0000, 3, 10),
(2, 111, 1.0000, 3, 11),
(2, 112, 1.0000, 3, 12),
(2, 113, 1.0000, 3, 13);

-- BOM 3: Cylo Plus @200 ltr (11 components from dev)
INSERT INTO bom_details (bom_header_id, raw_material_id, quantity, unit_of_measure_id, sequence) VALUES
(3, 68, 100.7000, 1, 1),
(3, 69, 0.8100, 1, 2),
(3, 71, 902.6200, 1, 3),
(3, 72, 0.8100, 1, 4),
(3, 73, 0.0500, 1, 5),
(3, 76, 2.0100, 1, 6),
(3, 74, 335.6667, 2, 7),
(3, 97, 1.0000, 3, 8),
(3, 109, 1.0000, 3, 9),
(3, 110, 1.0000, 3, 10),
(3, 113, 1.0000, 3, 11);

-- Verify restore
SELECT bh.id, bh.product_name, COUNT(bd.id) AS components
FROM bom_headers bh LEFT JOIN bom_details bd ON bd.bom_header_id = bh.id
GROUP BY bh.id ORDER BY bh.id;
