-- Sample existing products
SELECT id, sku, name, category_id, product_type_id FROM products LIMIT 5;

-- Unique item_codes in BOM details
SELECT COUNT(DISTINCT bd.item_code) as unique_items_in_bom FROM bom_details bd WHERE bd.item_code IS NOT NULL AND bd.item_code != '';

-- Already exist in products (by sku)
SELECT COUNT(DISTINCT bd.item_code) as already_in_products FROM bom_details bd JOIN products p ON bd.item_code = p.sku WHERE bd.item_code IS NOT NULL AND bd.item_code != '';

-- Missing from products (raw materials/components)
SELECT COUNT(DISTINCT bd.item_code) as missing_rm FROM bom_details bd LEFT JOIN products p ON bd.item_code = p.sku WHERE bd.item_code IS NOT NULL AND bd.item_code != '' AND p.id IS NULL;

-- Sample missing RM items
SELECT DISTINCT bd.item_code, bd.item_description, bd.unit FROM bom_details bd LEFT JOIN products p ON bd.item_code = p.sku WHERE bd.item_code IS NOT NULL AND bd.item_code != '' AND p.id IS NULL LIMIT 15;

-- Missing FG (finished goods from BOM headers)
SELECT COUNT(DISTINCT bh.bom_code) as missing_fg FROM bom_headers bh LEFT JOIN products p ON bh.bom_code = p.sku WHERE bh.bom_code IS NOT NULL AND bh.source = 'JBOX' AND p.id IS NULL;

-- Sample missing FG
SELECT DISTINCT bh.bom_code, bh.product_name, bh.unit FROM bom_headers bh LEFT JOIN products p ON bh.bom_code = p.sku WHERE bh.bom_code IS NOT NULL AND bh.source = 'JBOX' AND p.id IS NULL LIMIT 15;

-- Check categories
SELECT id, name FROM product_categories ORDER BY id;

-- Check product_types
SELECT id, name FROM product_types ORDER BY id;
