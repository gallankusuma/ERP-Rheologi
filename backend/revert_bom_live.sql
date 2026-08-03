-- REVERT BOM product_name ke data asli (SAFE)
UPDATE bom_headers SET product_name = 'Cylo @200 ltr' WHERE id = 1;
UPDATE bom_headers SET product_name = 'Cylo Bind @2.5 gal' WHERE id = 2;
UPDATE bom_headers SET product_name = 'Cylo Plus @200 ltr' WHERE id = 3;

-- Verify
SELECT id, product_id, product_name, status FROM bom_headers ORDER BY id;
