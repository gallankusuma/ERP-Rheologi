-- Check warehouses
SELECT * FROM warehouses;

-- Check inventory_stocks schema and current data
DESCRIBE inventory_stocks;

-- Check stock_movements schema  
DESCRIBE stock_movements;

-- Check what products have stock movements (GRN receipts, etc)
SELECT sm.movement_type, COUNT(*) as cnt, 
  GROUP_CONCAT(DISTINCT sm.reference_type) as ref_types
FROM stock_movements sm
GROUP BY sm.movement_type;

-- Check recent stock movements
SELECT sm.*, p.name as product_name 
FROM stock_movements sm 
LEFT JOIN products p ON sm.product_id = p.id
ORDER BY sm.created_at DESC LIMIT 10;

-- Check procurement GRN data that should have created stock
SELECT COUNT(*) as grn_count FROM good_receipts;
