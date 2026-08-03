-- Create line_processes table (safe, IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS line_processes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50),
  description TEXT,
  capacity_per_hour DECIMAL(15,2),
  capacity_unit VARCHAR(50),
  active TINYINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

SELECT 'line_processes table ready' AS result;
