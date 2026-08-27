-- HR V2 permissions: command center and MVP factory HR modules
INSERT IGNORE INTO permissions (resource, action, module, name, description) VALUES
('hr.command-center', 'view', 'HR - Command Center', 'View HR Command Center', 'View workforce KPI, exception queue, and HR operational cockpit'),
('hr.employees', 'view', 'HR - Employee Master', 'View Employees', 'View employee directory and Employee 360 data'),
('hr.employees', 'create', 'HR - Employee Master', 'Create Employee', 'Create employee master records'),
('hr.employees', 'update', 'HR - Employee Master', 'Update Employee', 'Update employee master records'),
('hr.employees', 'delete', 'HR - Employee Master', 'Delete Draft Employee', 'Delete employee records when allowed by status and reference rules'),
('hr.attendance', 'view', 'HR - Attendance', 'View Attendance', 'View attendance monitor, punch logs, and exceptions'),
('hr.attendance', 'create', 'HR - Attendance', 'Create Attendance', 'Record attendance entries'),
('hr.attendance', 'update', 'HR - Attendance', 'Update Attendance', 'Resolve attendance entries and corrections'),
('hr.payroll', 'view', 'HR - Payroll', 'View Payroll', 'View payroll workspace, runs, and payslip records'),
('hr.payroll', 'create', 'HR - Payroll', 'Create Payroll Run', 'Create payroll requests and calculation runs'),
('hr.payroll', 'approve', 'HR - Payroll', 'Approve Payroll', 'Approve payroll requests and payroll run outputs'),
('hr.position-rates', 'view', 'HR - Position Rates', 'View Position Rates', 'View position rate and grade configuration'),
('hr.position-rates', 'create', 'HR - Position Rates', 'Create Position Rate', 'Create position rate configuration'),
('hr.position-rates', 'update', 'HR - Position Rates', 'Update Position Rate', 'Update position rate configuration'),
('hr.salary-advances', 'view', 'HR - Salary Advances', 'View Salary Advances', 'View employee salary advances'),
('hr.salary-advances', 'create', 'HR - Salary Advances', 'Create Salary Advance', 'Create employee salary advance requests'),
('hr.salary-advances', 'approve', 'HR - Salary Advances', 'Approve Salary Advance', 'Approve employee salary advance requests'),
('hr.mobile-portal', 'view', 'HR - ESS / MSS', 'View ESS Portal', 'View employee and manager self-service portal');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r
  JOIN permissions p ON p.resource LIKE 'hr.%'
 WHERE LOWER(r.name) IN ('admin', 'super admin', 'super administrator');
