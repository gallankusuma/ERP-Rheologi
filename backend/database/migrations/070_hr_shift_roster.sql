-- HR Shift & Roster foundation

CREATE TABLE IF NOT EXISTS hr_shift_definitions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  start_time TIME NULL,
  end_time TIME NULL,
  crosses_midnight TINYINT(1) NOT NULL DEFAULT 0,
  paid_hours DECIMAL(5,2) NOT NULL DEFAULT 8.00,
  color VARCHAR(30) NULL,
  is_working_day TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hr_rotation_patterns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pattern_code VARCHAR(40) NOT NULL,
  group_code VARCHAR(10) NOT NULL,
  day_index INT NOT NULL,
  shift_code VARCHAR(20) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_hr_rotation_group_day (pattern_code, group_code, day_index),
  KEY idx_hr_rotation_shift_code (shift_code)
);

CREATE TABLE IF NOT EXISTS hr_roster_overrides (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  roster_date DATE NOT NULL,
  shift_code VARCHAR(20) NULL,
  override_type VARCHAR(30) NOT NULL DEFAULT 'manual',
  reason TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_hr_roster_override_employee_date (employee_id, roster_date),
  KEY idx_hr_roster_override_date (roster_date),
  CONSTRAINT fk_hr_roster_override_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

INSERT INTO hr_shift_definitions (code, name, start_time, end_time, crosses_midnight, paid_hours, color, is_working_day, sort_order)
VALUES
  ('S1', 'Shift 1 - Morning', '06:00:00', '14:00:00', 0, 8.00, 'emerald', 1, 1),
  ('S2', 'Shift 2 - Afternoon', '14:00:00', '22:00:00', 0, 8.00, 'sky', 1, 2),
  ('S3', 'Shift 3 - Night', '22:00:00', '06:00:00', 1, 8.00, 'indigo', 1, 3),
  ('OFF', 'Off / Rest Day', NULL, NULL, 0, 0.00, 'slate', 0, 4)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  start_time = VALUES(start_time),
  end_time = VALUES(end_time),
  crosses_midnight = VALUES(crosses_midnight),
  paid_hours = VALUES(paid_hours),
  color = VALUES(color),
  is_working_day = VALUES(is_working_day),
  sort_order = VALUES(sort_order),
  active = 1;

INSERT INTO hr_rotation_patterns (pattern_code, group_code, day_index, shift_code)
VALUES
  ('FACTORY_2222', 'A', 0, 'S1'), ('FACTORY_2222', 'A', 1, 'S1'), ('FACTORY_2222', 'A', 2, 'S2'), ('FACTORY_2222', 'A', 3, 'S2'), ('FACTORY_2222', 'A', 4, 'S3'), ('FACTORY_2222', 'A', 5, 'S3'), ('FACTORY_2222', 'A', 6, 'OFF'), ('FACTORY_2222', 'A', 7, 'OFF'),
  ('FACTORY_2222', 'B', 0, 'S2'), ('FACTORY_2222', 'B', 1, 'S2'), ('FACTORY_2222', 'B', 2, 'S3'), ('FACTORY_2222', 'B', 3, 'S3'), ('FACTORY_2222', 'B', 4, 'OFF'), ('FACTORY_2222', 'B', 5, 'OFF'), ('FACTORY_2222', 'B', 6, 'S1'), ('FACTORY_2222', 'B', 7, 'S1'),
  ('FACTORY_2222', 'C', 0, 'S3'), ('FACTORY_2222', 'C', 1, 'S3'), ('FACTORY_2222', 'C', 2, 'OFF'), ('FACTORY_2222', 'C', 3, 'OFF'), ('FACTORY_2222', 'C', 4, 'S1'), ('FACTORY_2222', 'C', 5, 'S1'), ('FACTORY_2222', 'C', 6, 'S2'), ('FACTORY_2222', 'C', 7, 'S2'),
  ('FACTORY_2222', 'D', 0, 'OFF'), ('FACTORY_2222', 'D', 1, 'OFF'), ('FACTORY_2222', 'D', 2, 'S1'), ('FACTORY_2222', 'D', 3, 'S1'), ('FACTORY_2222', 'D', 4, 'S2'), ('FACTORY_2222', 'D', 5, 'S2'), ('FACTORY_2222', 'D', 6, 'S3'), ('FACTORY_2222', 'D', 7, 'S3')
ON DUPLICATE KEY UPDATE shift_code = VALUES(shift_code), active = 1;

INSERT IGNORE INTO permissions (resource, action, module, name, description) VALUES
('hr.shift-roster', 'view', 'HR - Shift & Roster', 'View Shift & Roster', 'View shift definitions, rotation pattern, and roster preview'),
('hr.shift-roster', 'create', 'HR - Shift & Roster', 'Generate Roster', 'Generate or publish roster plans'),
('hr.shift-roster', 'update', 'HR - Shift & Roster', 'Update Roster', 'Update shift definitions or roster overrides');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r
  JOIN permissions p ON p.resource = 'hr.shift-roster'
 WHERE r.name IN ('Admin', 'Super Admin', 'Super Administrator');
