-- HR Payroll records foundation

CREATE TABLE IF NOT EXISTS payslip_records (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  period_month INT NOT NULL,
  period_year INT NOT NULL,
  project_id INT NULL,
  total_days DECIMAL(5,2) DEFAULT 0,
  total_ot_hours DECIMAL(6,2) DEFAULT 0,
  basic_salary DECIMAL(12,2) DEFAULT 0,
  tunjangan DECIMAL(12,2) DEFAULT 0,
  ot_pay DECIMAL(12,2) DEFAULT 0,
  gross_salary DECIMAL(12,2) DEFAULT 0,
  advance_1 DECIMAL(12,2) DEFAULT 0,
  advance_2 DECIMAL(12,2) DEFAULT 0,
  reimbursement DECIMAL(12,2) DEFAULT 0,
  bpjs_kes DECIMAL(12,2) DEFAULT 0,
  bpjs_tk DECIMAL(12,2) DEFAULT 0,
  pph21 DECIMAL(12,2) DEFAULT 0,
  total_deductions DECIMAL(12,2) DEFAULT 0,
  net_salary DECIMAL(12,2) DEFAULT 0,
  notes TEXT NULL,
  status VARCHAR(20) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_payslip_employee (employee_id),
  CONSTRAINT fk_payslip_employee FOREIGN KEY (employee_id) REFERENCES employees(id)
);

ALTER TABLE payslip_records
  ADD UNIQUE KEY IF NOT EXISTS uq_payslip_employee_period (employee_id, period_month, period_year);
