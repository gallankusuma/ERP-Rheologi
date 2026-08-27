-- Attendance should have one canonical daily record per employee.

ALTER TABLE attendance_logs
  ADD UNIQUE KEY IF NOT EXISTS uq_attendance_employee_date (employee_id, date);
