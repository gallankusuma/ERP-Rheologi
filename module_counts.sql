SELECT 'inventory_stocks' as tbl, COUNT(*) as cnt FROM inventory_stocks
UNION ALL SELECT 'stock_movements', COUNT(*) FROM stock_movements
UNION ALL SELECT 'stock_transfers', COUNT(*) FROM stock_transfers
UNION ALL SELECT 'warehouses', COUNT(*) FROM warehouses
UNION ALL SELECT 'warehouse_locations', COUNT(*) FROM warehouse_locations
UNION ALL SELECT 'work_orders', COUNT(*) FROM work_orders
UNION ALL SELECT 'wo_materials', COUNT(*) FROM wo_materials
UNION ALL SELECT 'wo_results', COUNT(*) FROM wo_results
UNION ALL SELECT 'mps_headers', COUNT(*) FROM mps_headers
UNION ALL SELECT 'mps_details', COUNT(*) FROM mps_details
UNION ALL SELECT 'forecast_headers', COUNT(*) FROM forecast_headers
UNION ALL SELECT 'mrp_planned_orders', COUNT(*) FROM mrp_planned_orders
UNION ALL SELECT 'sales_orders', COUNT(*) FROM sales_orders;
