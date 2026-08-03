ALTER TABLE work_orders ADD COLUMN priority VARCHAR(20) DEFAULT 'normal' AFTER status;
