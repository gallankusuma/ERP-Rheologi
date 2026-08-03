-- Add line_process_id to work_orders (SAFE, additive only)
ALTER TABLE work_orders ADD COLUMN line_process_id INT NULL AFTER bom_id;

SELECT 'work_orders.line_process_id added' AS result;
