-- Add remark fields to mps_details
ALTER TABLE mps_details ADD COLUMN current_stock DECIMAL(15,2) DEFAULT 0;
ALTER TABLE mps_details ADD COLUMN batch_no VARCHAR(50);
ALTER TABLE mps_details ADD COLUMN batch_qty DECIMAL(15,2) DEFAULT 0;
ALTER TABLE mps_details ADD COLUMN lead_time_weeks INT DEFAULT 1;

-- Weekly grid data: each product has 5 task rows across many weeks
CREATE TABLE IF NOT EXISTS mps_week_data (
  id INT PRIMARY KEY AUTO_INCREMENT,
  mps_detail_id INT NOT NULL,
  week_number INT NOT NULL,
  year INT NOT NULL,
  forecast_qty DECIMAL(15,2) DEFAULT 0,
  so_qty DECIMAL(15,2) DEFAULT 0,
  start_process_qty DECIMAL(15,2) DEFAULT 0,
  fg_qty DECIMAL(15,2) DEFAULT 0,
  FOREIGN KEY (mps_detail_id) REFERENCES mps_details(id) ON DELETE CASCADE,
  UNIQUE KEY uq_detail_week (mps_detail_id, year, week_number)
);
