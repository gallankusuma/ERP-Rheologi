-- HR V2 employee master extension
-- Adds factory HR fields needed by Employee 360, shift/roster, payroll grouping, and ESS/MSS.

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS employment_type VARCHAR(30) NULL DEFAULT 'permanent' AFTER salary_type,
  ADD COLUMN IF NOT EXISTS employment_status VARCHAR(30) NULL DEFAULT 'active' AFTER employment_type,
  ADD COLUMN IF NOT EXISTS contract_start_date DATE NULL AFTER employment_status,
  ADD COLUMN IF NOT EXISTS contract_end_date DATE NULL AFTER contract_start_date,
  ADD COLUMN IF NOT EXISTS probation_end_date DATE NULL AFTER contract_end_date,
  ADD COLUMN IF NOT EXISTS supervisor_id INT NULL AFTER probation_end_date,
  ADD COLUMN IF NOT EXISTS payroll_group VARCHAR(60) NULL AFTER supervisor_id,
  ADD COLUMN IF NOT EXISTS work_calendar VARCHAR(60) NULL AFTER payroll_group,
  ADD COLUMN IF NOT EXISTS work_mode VARCHAR(20) NULL DEFAULT 'shift' AFTER work_calendar,
  ADD COLUMN IF NOT EXISTS shift_group VARCHAR(10) NULL AFTER work_mode,
  ADD COLUMN IF NOT EXISTS roster_anchor_date DATE NULL AFTER shift_group,
  ADD COLUMN IF NOT EXISTS site VARCHAR(100) NULL AFTER roster_anchor_date,
  ADD COLUMN IF NOT EXISTS section VARCHAR(100) NULL AFTER site,
  ADD COLUMN IF NOT EXISTS cost_center VARCHAR(80) NULL AFTER section,
  ADD COLUMN IF NOT EXISTS grade VARCHAR(40) NULL AFTER cost_center,
  ADD COLUMN IF NOT EXISTS notes TEXT NULL AFTER grade;

CREATE INDEX IF NOT EXISTS idx_employees_supervisor_id ON employees (supervisor_id);
CREATE INDEX IF NOT EXISTS idx_employees_shift_group ON employees (shift_group);
CREATE INDEX IF NOT EXISTS idx_employees_payroll_group ON employees (payroll_group);
