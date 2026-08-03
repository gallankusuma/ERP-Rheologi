-- Fix bom_headers schema for MySQL 8
ALTER TABLE bom_headers 
  ADD COLUMN jbox_id int DEFAULT NULL,
  ADD COLUMN bom_code varchar(100) DEFAULT NULL,
  ADD COLUMN qty varchar(50) DEFAULT NULL,
  ADD COLUMN unit varchar(50) DEFAULT NULL,
  ADD COLUMN process_type varchar(100) DEFAULT NULL,
  ADD COLUMN production_line varchar(100) DEFAULT NULL,
  ADD COLUMN source varchar(50) DEFAULT 'ERP';

-- Fix bom_details schema
ALTER TABLE bom_details
  ADD COLUMN item_code varchar(100) DEFAULT NULL,
  ADD COLUMN item_description varchar(500) DEFAULT NULL,
  ADD COLUMN unit varchar(50) DEFAULT NULL,
  ADD COLUMN use_tolerance varchar(10) DEFAULT 'No',
  ADD COLUMN pct_tolerance decimal(10,4) DEFAULT 0,
  ADD COLUMN tolerance_value decimal(10,4) DEFAULT 0,
  ADD COLUMN remark text DEFAULT NULL;
