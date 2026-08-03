SELECT * FROM products WHERE name LIKE '%C2509%';
SELECT * FROM bom_headers WHERE product_id = (SELECT id FROM products WHERE name LIKE '%C2509%' LIMIT 1);
