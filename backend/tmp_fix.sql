UPDATE sales_orders SET project_id = NULL WHERE project_id IS NOT NULL;
SELECT id, so_number, status, project_id FROM sales_orders;
