-- 1. Create missing qc_test_definitions table
CREATE TABLE IF NOT EXISTS qc_test_definitions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  test_id INT NOT NULL,
  min_value VARCHAR(100),
  max_value VARCHAR(100),
  target_value VARCHAR(100),
  is_required TINYINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (test_id) REFERENCES qc_tests(id)
);

-- 2. Fix qc_analysis_requests: change ENUM to VARCHAR + add missing columns
ALTER TABLE qc_analysis_requests MODIFY COLUMN status VARCHAR(50) DEFAULT 'Pending';
ALTER TABLE qc_analysis_requests MODIFY COLUMN result VARCHAR(50) DEFAULT NULL;

-- Add missing columns (safe: ignore if already exists)
SET @dbname = DATABASE();
SET @tablename = 'qc_analysis_requests';

-- reference_number
SET @col = 'reference_number';
SET @q = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE qc_analysis_requests ADD COLUMN reference_number VARCHAR(100)', 'SELECT 1') FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@col);
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- batch_no
SET @col = 'batch_no';
SET @q = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE qc_analysis_requests ADD COLUMN batch_no VARCHAR(100)', 'SELECT 1') FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@col);
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- quantity
SET @col = 'quantity';
SET @q = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE qc_analysis_requests ADD COLUMN quantity DECIMAL(15,4)', 'SELECT 1') FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@col);
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- supplier_id
SET @col = 'supplier_id';
SET @q = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE qc_analysis_requests ADD COLUMN supplier_id INT', 'SELECT 1') FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@col);
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- reviewed_by
SET @col = 'reviewed_by';
SET @q = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE qc_analysis_requests ADD COLUMN reviewed_by INT', 'SELECT 1') FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@col);
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- reviewed_at
SET @col = 'reviewed_at';
SET @q = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE qc_analysis_requests ADD COLUMN reviewed_at TIMESTAMP NULL', 'SELECT 1') FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@col);
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- review_notes
SET @col = 'review_notes';
SET @q = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE qc_analysis_requests ADD COLUMN review_notes TEXT', 'SELECT 1') FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@col);
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- rs_number (for RS tracking)
SET @col = 'rs_number';
SET @q = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE qc_analysis_requests ADD COLUMN rs_number VARCHAR(100)', 'SELECT 1') FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@col);
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. Fix qc_results: add missing alias columns
SET @tablename = 'qc_results';

SET @col = 'test_id';
SET @q = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE qc_results ADD COLUMN test_id INT', 'SELECT 1') FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@col);
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = 'tester_id';
SET @q = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE qc_results ADD COLUMN tester_id INT', 'SELECT 1') FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@col);
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = 'tested_at';
SET @q = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE qc_results ADD COLUMN tested_at TIMESTAMP NULL', 'SELECT 1') FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@col);
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = 'result';
SET @q = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE qc_results ADD COLUMN result VARCHAR(255)', 'SELECT 1') FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@col);
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = 'status';
SET @q = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE qc_results ADD COLUMN status VARCHAR(50) DEFAULT \"pending\"', 'SELECT 1') FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@col);
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = 'approved_by';
SET @q = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE qc_results ADD COLUMN approved_by INT', 'SELECT 1') FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@col);
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = 'approved_at';
SET @q = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE qc_results ADD COLUMN approved_at TIMESTAMP NULL', 'SELECT 1') FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@col);
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Sync test_id with qc_test_id for existing rows
UPDATE qc_results SET test_id = qc_test_id WHERE test_id IS NULL AND qc_test_id IS NOT NULL;

-- 4. Fix batches: add missing columns
SET @tablename = 'batches';

SET @col = 'qc_status';
SET @q = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE batches ADD COLUMN qc_status VARCHAR(50) DEFAULT \"pending\"', 'SELECT 1') FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@col);
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = 'mfg_date';
SET @q = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE batches ADD COLUMN mfg_date DATE', 'SELECT 1') FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@col);
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = 'exp_date';
SET @q = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE batches ADD COLUMN exp_date DATE', 'SELECT 1') FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@col);
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = 'updated_at';
SET @q = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE batches ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'SELECT 1') FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@col);
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Sync mfg_date/exp_date with existing data
UPDATE batches SET mfg_date = manufacture_date WHERE mfg_date IS NULL AND manufacture_date IS NOT NULL;
UPDATE batches SET exp_date = expiry_date WHERE exp_date IS NULL AND expiry_date IS NOT NULL;

-- 5. Fix qc_analysis_results: add missing columns
SET @tablename = 'qc_analysis_results';

SET @col = 'method_id';
SET @q = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE qc_analysis_results ADD COLUMN method_id INT', 'SELECT 1') FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@col);
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = 'standard_value';
SET @q = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE qc_analysis_results ADD COLUMN standard_value VARCHAR(100)', 'SELECT 1') FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@col);
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = 'min_value';
SET @q = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE qc_analysis_results ADD COLUMN min_value VARCHAR(100)', 'SELECT 1') FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@col);
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = 'max_value';
SET @q = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE qc_analysis_results ADD COLUMN max_value VARCHAR(100)', 'SELECT 1') FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@col);
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = 'instrument_id';
SET @q = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE qc_analysis_results ADD COLUMN instrument_id INT', 'SELECT 1') FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@col);
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = 'actual_value';
SET @q = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE qc_analysis_results ADD COLUMN actual_value VARCHAR(255)', 'SELECT 1') FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@col);
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = 'is_pass';
SET @q = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE qc_analysis_results ADD COLUMN is_pass TINYINT', 'SELECT 1') FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tablename AND COLUMN_NAME=@col);
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT 'ALL MIGRATIONS COMPLETE' as result;
