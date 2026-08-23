CREATE TABLE IF NOT EXISTS employee_leave_balances (
  id INT PRIMARY KEY AUTO_INCREMENT,
  employee_id INT NOT NULL,
  balance_year SMALLINT NOT NULL,
  leave_type VARCHAR(40) NOT NULL DEFAULT 'annual',
  entitlement DECIMAL(6,2) NOT NULL DEFAULT 0,
  carried_forward DECIMAL(6,2) NOT NULL DEFAULT 0,
  used_days DECIMAL(6,2) NOT NULL DEFAULT 0,
  pending_days DECIMAL(6,2) NOT NULL DEFAULT 0,
  notes VARCHAR(500) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_employee_leave_balance_employee
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  UNIQUE KEY uq_employee_leave_balance (employee_id, balance_year, leave_type),
  INDEX idx_leave_balance_year (balance_year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS employee_self_service_requests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  request_number VARCHAR(60) NOT NULL,
  employee_id INT NOT NULL,
  request_type VARCHAR(40) NOT NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  requested_days DECIMAL(6,2) NULL,
  amount DECIMAL(15,2) NULL,
  destination VARCHAR(255) NULL,
  reason TEXT NOT NULL,
  notes TEXT NULL,
  metadata JSON NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'submitted',
  submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approver_id INT NULL,
  decided_at DATETIME NULL,
  decision_notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ess_request_employee
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  CONSTRAINT fk_ess_request_approver
    FOREIGN KEY (approver_id) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY uq_ess_request_number (request_number),
  INDEX idx_ess_employee_status (employee_id, status),
  INDEX idx_ess_employee_type (employee_id, request_type),
  INDEX idx_ess_submitted_at (submitted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
