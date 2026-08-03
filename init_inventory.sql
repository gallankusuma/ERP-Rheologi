-- PHASE 1: Initialize inventory_stocks from stock_movements (GRN data)
-- We have 23 inbound movements from GRN that never updated inventory_stocks

-- Step 1: Aggregate all stock movements into inventory_stocks
INSERT INTO inventory_stocks (warehouse_id, product_id, quantity, reorder_point, last_updated)
SELECT 
  sm.warehouse_id,
  sm.product_id,
  SUM(CASE 
    WHEN sm.movement_type IN ('inbound', 'receipt', 'fg_receipt', 'adjustment_in') THEN sm.quantity
    WHEN sm.movement_type IN ('outbound', 'issue', 'adjustment_out') THEN -sm.quantity
    ELSE 0
  END) as net_quantity,
  10 as reorder_point,
  MAX(sm.created_at) as last_updated
FROM stock_movements sm
GROUP BY sm.warehouse_id, sm.product_id
HAVING net_quantity > 0
ON DUPLICATE KEY UPDATE
  quantity = VALUES(quantity),
  last_updated = VALUES(last_updated);

-- Step 2: Also add all raw materials from BOM that are not yet in inventory (with 0 stock)
-- This ensures MRP can reference them
INSERT IGNORE INTO inventory_stocks (warehouse_id, product_id, quantity, reorder_point)
SELECT DISTINCT
  1 as warehouse_id,
  bd.raw_material_id as product_id,
  0 as quantity,
  10 as reorder_point
FROM bom_details bd
WHERE bd.raw_material_id IS NOT NULL
  AND bd.raw_material_id > 0
  AND EXISTS (SELECT 1 FROM products p WHERE p.id = bd.raw_material_id);

-- Step 3: Also add all finished goods products (with 0 stock)
INSERT IGNORE INTO inventory_stocks (warehouse_id, product_id, quantity, reorder_point)
SELECT DISTINCT
  1 as warehouse_id,
  bh.product_id,
  0 as quantity,
  10 as reorder_point
FROM bom_headers bh
WHERE bh.product_id IS NOT NULL
  AND bh.product_id > 0
  AND EXISTS (SELECT 1 FROM products p WHERE p.id = bh.product_id);

-- Show results
SELECT 'Total inventory_stocks after init' as info, COUNT(*) as cnt FROM inventory_stocks;
SELECT warehouse_id, COUNT(*) as products, 
  SUM(CASE WHEN quantity > 0 THEN 1 ELSE 0 END) as with_stock,
  SUM(CASE WHEN quantity = 0 THEN 1 ELSE 0 END) as zero_stock
FROM inventory_stocks 
GROUP BY warehouse_id;
