import express, { Request, Response } from 'express';
import { dbAll, dbGet, dbRun } from '../config/database';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

const ESS_REQUEST_TYPES = ['leave', 'permission', 'medical', 'business_trip'] as const;
type EssRequestType = typeof ESS_REQUEST_TYPES[number];

function currentUserId(req: Request): number | null {
  const value = Number((req as any).user?.userId || (req as any).userId);
  return Number.isFinite(value) && value > 0 ? value : null;
}

async function resolveCurrentEmployee(req: Request) {
  const userId = currentUserId(req);
  if (!userId) return null;

  const byUserId = await dbGet(
    `SELECT e.*, d.name AS department_name
       FROM employees e
       LEFT JOIN departments d ON d.id = e.department_id
      WHERE e.user_id = ?
      LIMIT 1`,
    [userId]
  ) as any;
  if (byUserId) return byUserId;

  if (userId === 99999) return null;

  return await dbGet(
    `SELECT e.*, d.name AS department_name
       FROM employees e
       LEFT JOIN departments d ON d.id = e.department_id
       INNER JOIN users u ON LOWER(u.email) = LOWER(e.email)
      WHERE u.id = ?
      LIMIT 1`,
    [userId]
  ) as any;
}

async function resolveCurrentUser(req: Request) {
  const userId = currentUserId(req);
  if (userId === 99999) {
    return { id: 99999, full_name: 'Master Admin', email: 'master@admin.com' };
  }
  return userId
    ? await dbGet('SELECT id, full_name, email FROM users WHERE id = ?', [userId]) as any
    : null;
}

function requestNumber(type: EssRequestType) {
  const prefix: Record<EssRequestType, string> = {
    leave: 'CUTI',
    permission: 'IZIN',
    medical: 'MED',
    business_trip: 'SPD',
  };
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  return `${prefix[type]}-${stamp}-${Date.now().toString().slice(-5)}`;
}

function inclusiveDays(startDate?: string, endDate?: string): number | null {
  if (!startDate || !endDate) return null;
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Math.floor((end - start) / 86400000) + 1;
}

const essRequestSelect = `
  SELECT r.id, r.request_number, r.request_type, r.start_date, r.end_date,
         r.requested_days, r.amount, r.destination, r.reason, r.notes,
         r.status, r.submitted_at, r.decided_at, r.decision_notes,
         u.full_name AS approver_name
    FROM employee_self_service_requests r
    LEFT JOIN users u ON u.id = r.approver_id`;

const hrRequestSelect = `
  SELECT r.id, r.request_number, r.request_type, r.start_date, r.end_date,
         r.requested_days, r.amount, r.destination, r.reason, r.notes,
         r.status, r.submitted_at, r.decided_at, r.decision_notes,
         e.id AS employee_id, e.code AS employee_code, e.name AS employee_name,
         e.position, e.shift_group, e.work_mode, e.site, e.section,
         d.name AS department_name,
         u.full_name AS approver_name
    FROM employee_self_service_requests r
    LEFT JOIN employees e ON e.id = r.employee_id
    LEFT JOIN departments d ON d.id = e.department_id
    LEFT JOIN users u ON u.id = r.approver_id`;

const employeeSelect = `
  SELECT e.*,
         e.code AS employee_code,
         e.name AS first_name,
         e.salary AS basic_salary,
         e.salary_type AS contract_type,
         d.name AS department_name,
         s.name AS supervisor_name
    FROM employees e
    LEFT JOIN departments d ON e.department_id = d.id
    LEFT JOIN employees s ON s.id = e.supervisor_id`;

function normalizeEmployeeBody(body: any) {
  const salaryType = body.salary_type || body.contract_type || 'daily';
  const status = body.status || (body.is_active === false ? 'INACTIVE' : 'ACTIVE');
  const employmentStatus = body.employment_status || (status === 'ACTIVE' ? 'active' : 'inactive');
  const basicRate = Number(body.basic_rate ?? (salaryType === 'daily' ? body.basic_salary : 0)) || 0;
  const salary = Number(body.salary ?? (salaryType === 'monthly' ? body.basic_salary : 0)) || 0;

  return {
    code: body.code || body.employee_code,
    name: body.name || body.first_name || body.full_name,
    email: body.email || null,
    phone: body.phone || null,
    department_id: body.department_id || null,
    position: body.position || null,
    hire_date: body.hire_date || null,
    status,
    salary_type: salaryType,
    salary,
    basic_rate: basicRate,
    tunjangan_rate: Number(body.tunjangan_rate) || 0,
    ot_rate: Number(body.ot_rate) || 0,
    employment_type: body.employment_type || 'permanent',
    employment_status: employmentStatus,
    contract_start_date: body.contract_start_date || null,
    contract_end_date: body.contract_end_date || null,
    probation_end_date: body.probation_end_date || null,
    supervisor_id: body.supervisor_id || null,
    payroll_group: body.payroll_group || null,
    work_calendar: body.work_calendar || null,
    work_mode: body.work_mode || 'shift',
    shift_group: body.shift_group || null,
    roster_anchor_date: body.roster_anchor_date || null,
    site: body.site || null,
    section: body.section || null,
    cost_center: body.cost_center || null,
    grade: body.grade || null,
    notes: body.notes || null,
  };
}

function validateHrRequestBody(body: any) {
  const type = String(body?.request_type || '') as EssRequestType;
  const startDate = body?.start_date || null;
  const endDate = body?.end_date || startDate || null;
  const reason = String(body?.reason || '').trim();
  const amount = body?.amount === '' || body?.amount == null ? null : Number(body.amount);
  const destination = String(body?.destination || '').trim() || null;
  const notes = String(body?.notes || '').trim() || null;

  if (!ESS_REQUEST_TYPES.includes(type)) return { error: 'Unsupported request type' };
  if (!reason) return { error: 'Reason is required' };
  if (type !== 'medical' && (!startDate || !endDate)) return { error: 'Start and end date are required' };
  if (startDate && endDate && !inclusiveDays(startDate, endDate)) return { error: 'End date must be on or after start date' };
  if (type === 'medical' && (!amount || amount <= 0)) return { error: 'Medical claim amount must be greater than zero' };
  if (type === 'business_trip' && !destination) return { error: 'Destination is required for a business trip' };

  return {
    type,
    startDate,
    endDate,
    reason,
    amount,
    destination,
    notes,
    requestedDays: inclusiveDays(startDate, endDate),
  };
}

// ===== EMPLOYEE SELF SERVICE =====

router.get('/me/overview', authMiddleware, async (req: Request, res: Response) => {
  try {
    const employee = await resolveCurrentEmployee(req);
    const user = await resolveCurrentUser(req);

    if (!employee) {
      return res.json({
        data: {
          linked: false,
          profile: {
            user_id: currentUserId(req),
            employee_id: null,
            employee_code: null,
            name: user?.full_name || 'Pengguna',
            email: user?.email || null,
            phone: null,
            position: null,
            department: null,
            hire_date: null,
          },
          attendance: { today: null, month: { present: 0, recorded: 0, attendance_rate: null } },
          leave: { available_days: null, entitlement: null, used_days: null, pending_days: null },
          medical: { year_claimed: 0, pending_amount: 0, pending_count: 0 },
          pending_requests: 0,
          recent_requests: [],
        },
      });
    }

    const todayAttendance = await dbGet(
      `SELECT id, date, check_in, check_out, status, notes
         FROM attendance_logs
        WHERE employee_id = ? AND date = CURRENT_DATE()
        LIMIT 1`,
      [employee.id]
    ) as any;

    const monthAttendance = await dbGet(
      `SELECT COUNT(*) AS recorded,
              SUM(CASE WHEN status IN ('present', 'late', 'half-day') THEN 1 ELSE 0 END) AS present
         FROM attendance_logs
        WHERE employee_id = ?
          AND MONTH(date) = MONTH(CURRENT_DATE())
          AND YEAR(date) = YEAR(CURRENT_DATE())`,
      [employee.id]
    ) as any;

    const leaveBalance = await dbGet(
      `SELECT entitlement, carried_forward, used_days, pending_days,
              (entitlement + carried_forward - used_days - pending_days) AS available_days
         FROM employee_leave_balances
        WHERE employee_id = ? AND balance_year = YEAR(CURRENT_DATE()) AND leave_type = 'annual'
        LIMIT 1`,
      [employee.id]
    ) as any;

    const requestSummary = await dbGet(
      `SELECT SUM(CASE WHEN status IN ('draft', 'submitted', 'in_review') THEN 1 ELSE 0 END) AS pending_requests,
              SUM(CASE WHEN request_type = 'leave' AND status IN ('draft', 'submitted', 'in_review')
                       THEN COALESCE(requested_days, 0) ELSE 0 END) AS pending_leave_days,
              SUM(CASE WHEN request_type = 'medical' AND YEAR(submitted_at) = YEAR(CURRENT_DATE())
                            AND status IN ('approved', 'paid') THEN COALESCE(amount, 0) ELSE 0 END) AS year_claimed,
              SUM(CASE WHEN request_type = 'medical' AND status IN ('draft', 'submitted', 'in_review')
                       THEN COALESCE(amount, 0) ELSE 0 END) AS pending_medical_amount,
              SUM(CASE WHEN request_type = 'medical' AND status IN ('draft', 'submitted', 'in_review')
                       THEN 1 ELSE 0 END) AS pending_medical_count
         FROM employee_self_service_requests
        WHERE employee_id = ?`,
      [employee.id]
    ) as any;

    const recentRequests = await dbAll(
      `${essRequestSelect}
        WHERE r.employee_id = ?
        ORDER BY r.submitted_at DESC, r.id DESC
        LIMIT 5`,
      [employee.id]
    );

    const recorded = Number(monthAttendance?.recorded || 0);
    const present = Number(monthAttendance?.present || 0);
    const pendingLeaveDays = Number(requestSummary?.pending_leave_days || 0);

    return res.json({
      data: {
        linked: true,
        profile: {
          user_id: currentUserId(req),
          employee_id: employee.id,
          employee_code: employee.code || employee.employee_code || null,
          name: employee.name || employee.first_name || employee.full_name,
          email: employee.email || user?.email || null,
          phone: employee.phone || null,
          position: employee.position || null,
          department: employee.department_name || null,
          hire_date: employee.hire_date || null,
        },
        attendance: {
          today: todayAttendance || null,
          month: {
            present,
            recorded,
            attendance_rate: recorded ? Math.round((present / recorded) * 100) : null,
          },
        },
        leave: leaveBalance
          ? {
              available_days: Math.max(
                0,
                Number(leaveBalance.entitlement || 0) + Number(leaveBalance.carried_forward || 0)
                  - Number(leaveBalance.used_days || 0) - pendingLeaveDays
              ),
              entitlement: Number(leaveBalance.entitlement || 0),
              used_days: Number(leaveBalance.used_days || 0),
              pending_days: pendingLeaveDays,
            }
          : { available_days: null, entitlement: null, used_days: null, pending_days: null },
        medical: {
          year_claimed: Number(requestSummary?.year_claimed || 0),
          pending_amount: Number(requestSummary?.pending_medical_amount || 0),
          pending_count: Number(requestSummary?.pending_medical_count || 0),
        },
        pending_requests: Number(requestSummary?.pending_requests || 0),
        recent_requests: recentRequests,
      },
    });
  } catch (error) {
    console.error('Error fetching ESS overview:', error);
    res.status(500).json({ error: 'Failed to fetch personal HR overview' });
  }
});

router.get('/me/attendance', authMiddleware, async (req: Request, res: Response) => {
  try {
    const employee = await resolveCurrentEmployee(req);
    if (!employee) return res.status(409).json({ error: 'User account is not linked to an employee profile' });

    const month = Math.min(12, Math.max(1, Number(req.query.month) || new Date().getMonth() + 1));
    const year = Math.min(2200, Math.max(2000, Number(req.query.year) || new Date().getFullYear()));
    const logs = await dbAll(
      `SELECT id, date, check_in, check_out, status, notes
         FROM attendance_logs
        WHERE employee_id = ? AND MONTH(date) = ? AND YEAR(date) = ?
        ORDER BY date DESC`,
      [employee.id, month, year]
    );
    res.json({ data: logs });
  } catch (error) {
    console.error('Error fetching personal attendance:', error);
    res.status(500).json({ error: 'Failed to fetch personal attendance' });
  }
});

router.post('/me/attendance/toggle', authMiddleware, async (req: Request, res: Response) => {
  try {
    const employee = await resolveCurrentEmployee(req);
    if (!employee) return res.status(409).json({ error: 'User account is not linked to an employee profile' });

    const existing = await dbGet(
      `SELECT id, check_in, check_out FROM attendance_logs
        WHERE employee_id = ? AND date = CURRENT_DATE() LIMIT 1`,
      [employee.id]
    ) as any;
    const time = new Date().toLocaleTimeString('en-GB', {
      hour12: false,
      timeZone: 'Asia/Jakarta',
    });

    if (!existing) {
      const result = await dbRun(
        `INSERT INTO attendance_logs (employee_id, date, check_in, status, notes)
         VALUES (?, CURRENT_DATE(), ?, 'present', ?)`,
        [employee.id, time, req.body?.notes || null]
      );
      return res.status(201).json({ data: { id: result.insertId, type: 'check_in', time }, message: 'Check-in berhasil' });
    }
    if (!existing.check_out) {
      await dbRun('UPDATE attendance_logs SET check_out = ? WHERE id = ?', [time, existing.id]);
      return res.json({ data: { id: existing.id, type: 'check_out', time }, message: 'Check-out berhasil' });
    }
    return res.status(409).json({ error: 'Attendance for today is already complete' });
  } catch (error) {
    console.error('Error toggling personal attendance:', error);
    res.status(500).json({ error: 'Failed to record attendance' });
  }
});

router.get('/me/requests', authMiddleware, async (req: Request, res: Response) => {
  try {
    const employee = await resolveCurrentEmployee(req);
    if (!employee) return res.status(409).json({ error: 'User account is not linked to an employee profile' });

    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    const requests = await dbAll(
      `${essRequestSelect}
        WHERE r.employee_id = ?
        ORDER BY r.submitted_at DESC, r.id DESC
        LIMIT ${limit}`,
      [employee.id]
    );
    res.json({ data: requests });
  } catch (error) {
    console.error('Error fetching ESS requests:', error);
    res.status(500).json({ error: 'Failed to fetch personal requests' });
  }
});

router.post('/me/requests', authMiddleware, async (req: Request, res: Response) => {
  try {
    const employee = await resolveCurrentEmployee(req);
    if (!employee) return res.status(409).json({ error: 'User account is not linked to an employee profile' });

    const parsed = validateHrRequestBody(req.body);
    if ('error' in parsed) return res.status(400).json({ error: parsed.error });

    const number = requestNumber(parsed.type);
    const result = await dbRun(
      `INSERT INTO employee_self_service_requests
        (request_number, employee_id, request_type, start_date, end_date,
         requested_days, amount, destination, reason, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted')`,
      [
        number,
        employee.id,
        parsed.type,
        parsed.startDate,
        parsed.endDate,
        parsed.requestedDays,
        parsed.amount,
        parsed.destination,
        parsed.reason,
        parsed.notes,
      ]
    );
    const created = await dbGet(
      `${essRequestSelect} WHERE r.id = ?`,
      [result.insertId]
    );
    res.status(201).json({ data: created, message: 'Pengajuan berhasil dikirim' });
  } catch (error) {
    console.error('Error creating ESS request:', error);
    res.status(500).json({ error: 'Failed to submit personal request' });
  }
});

// ===== HR REQUEST CENTER =====

router.get('/requests/summary', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const rows = await dbAll(
      `SELECT request_type, status, COUNT(*) AS count, COALESCE(SUM(requested_days), 0) AS days, COALESCE(SUM(amount), 0) AS amount
         FROM employee_self_service_requests
        GROUP BY request_type, status`,
      []
    );
    const leaveBalances = await dbAll(
      `SELECT COUNT(*) AS employees_with_balance,
              COALESCE(SUM(entitlement + carried_forward - used_days - pending_days), 0) AS available_days,
              COALESCE(SUM(used_days), 0) AS used_days,
              COALESCE(SUM(pending_days), 0) AS pending_days
         FROM employee_leave_balances
        WHERE balance_year = YEAR(CURRENT_DATE()) AND leave_type = 'annual'`,
      []
    );
    res.json({ data: { requests: rows, leave_balance: leaveBalances[0] || null } });
  } catch (error) {
    console.error('Error fetching HR request summary:', error);
    res.status(500).json({ error: 'Failed to fetch request summary' });
  }
});

router.get('/requests', authMiddleware, async (req: Request, res: Response) => {
  try {
    const status = String(req.query.status || '');
    const type = String(req.query.type || '');
    const year = Number(req.query.year) || new Date().getFullYear();
    const params: any[] = [year];
    const filters = ['YEAR(r.submitted_at) = ?'];
    if (status) {
      filters.push('r.status = ?');
      params.push(status);
    }
    if (type) {
      filters.push('r.request_type = ?');
      params.push(type);
    }
    const requests = await dbAll(
      `${hrRequestSelect}
        WHERE ${filters.join(' AND ')}
        ORDER BY FIELD(r.status, 'submitted', 'in_review', 'draft', 'approved', 'rejected', 'paid'), r.submitted_at DESC, r.id DESC`,
      params
    );
    res.json({ data: requests });
  } catch (error) {
    console.error('Error fetching HR requests:', error);
    res.status(500).json({ error: 'Failed to fetch HR requests' });
  }
});

router.post('/requests', authMiddleware, async (req: Request, res: Response) => {
  try {
    const employeeId = Number(req.body?.employee_id);
    if (!employeeId) return res.status(400).json({ error: 'employee_id is required' });
    const parsed = validateHrRequestBody(req.body);
    if ('error' in parsed) return res.status(400).json({ error: parsed.error });

    const number = requestNumber(parsed.type);
    const result = await dbRun(
      `INSERT INTO employee_self_service_requests
        (request_number, employee_id, request_type, start_date, end_date,
         requested_days, amount, destination, reason, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted')`,
      [
        number,
        employeeId,
        parsed.type,
        parsed.startDate,
        parsed.endDate,
        parsed.requestedDays,
        parsed.amount,
        parsed.destination,
        parsed.reason,
        parsed.notes,
      ]
    );
    const created = await dbGet(`${hrRequestSelect} WHERE r.id = ?`, [result.insertId]);
    res.status(201).json({ data: created, message: 'HR request created' });
  } catch (error) {
    console.error('Error creating HR request:', error);
    res.status(500).json({ error: 'Failed to create HR request' });
  }
});

router.put('/requests/:id/approve', authMiddleware, async (req: Request, res: Response) => {
  try {
    const approverId = currentUserId(req);
    const request = await dbGet('SELECT * FROM employee_self_service_requests WHERE id = ?', [req.params.id]) as any;
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (!['submitted', 'in_review'].includes(String(request.status))) {
      return res.status(409).json({ error: 'Only submitted or in review requests can be approved' });
    }

    await dbRun(
      `UPDATE employee_self_service_requests
          SET status = 'approved', approver_id = ?, decided_at = CURRENT_TIMESTAMP, decision_notes = ?
        WHERE id = ?`,
      [approverId === 99999 ? null : approverId, req.body?.decision_notes || null, req.params.id]
    );

    if (request.request_type === 'leave') {
      await dbRun(
        `INSERT INTO employee_leave_balances (employee_id, balance_year, leave_type, entitlement, used_days)
         VALUES (?, YEAR(CURRENT_DATE()), 'annual', 12, ?)
         ON DUPLICATE KEY UPDATE used_days = used_days + VALUES(used_days), pending_days = GREATEST(0, pending_days - VALUES(used_days))`,
        [request.employee_id, Number(request.requested_days || 0)]
      );
    }

    if (['leave', 'permission', 'business_trip'].includes(String(request.request_type)) && request.start_date) {
      const startDate = new Date(`${request.start_date}T00:00:00Z`);
      const endDate = new Date(`${request.end_date || request.start_date}T00:00:00Z`);
      for (let cursor = startDate; cursor <= endDate; cursor = addDays(cursor, 1)) {
        await dbRun(
          `INSERT INTO attendance_logs (employee_id, date, status, notes, timesheet_value, overtime_hours)
           VALUES (?, ?, ?, ?, 1, 0)
           ON DUPLICATE KEY UPDATE status = VALUES(status), notes = VALUES(notes), timesheet_value = VALUES(timesheet_value)`,
          [
            request.employee_id,
            isoDate(cursor),
            request.request_type,
            `${request.request_number}: ${request.reason || ''}`.trim(),
          ]
        );
      }
    }

    const updated = await dbGet(`${hrRequestSelect} WHERE r.id = ?`, [req.params.id]);
    res.json({ data: updated, message: 'Request approved' });
  } catch (error) {
    console.error('Error approving HR request:', error);
    res.status(500).json({ error: 'Failed to approve HR request' });
  }
});

router.put('/requests/:id/reject', authMiddleware, async (req: Request, res: Response) => {
  try {
    const approverId = currentUserId(req);
    const request = await dbGet('SELECT id FROM employee_self_service_requests WHERE id = ?', [req.params.id]);
    if (!request) return res.status(404).json({ error: 'Request not found' });

    await dbRun(
      `UPDATE employee_self_service_requests
          SET status = 'rejected', approver_id = ?, decided_at = CURRENT_TIMESTAMP, decision_notes = ?
        WHERE id = ?`,
      [approverId === 99999 ? null : approverId, req.body?.decision_notes || null, req.params.id]
    );
    const updated = await dbGet(`${hrRequestSelect} WHERE r.id = ?`, [req.params.id]);
    res.json({ data: updated, message: 'Request rejected' });
  } catch (error) {
    console.error('Error rejecting HR request:', error);
    res.status(500).json({ error: 'Failed to reject HR request' });
  }
});

// ===== EMPLOYEES (HR LITE) =====

// Get all employees
router.get('/employees', authMiddleware, async (req: Request, res: Response) => {
  try {
    const employees = await dbAll(
      `${employeeSelect}
       ORDER BY e.name ASC`,
      []
    );
    res.json({ data: employees });
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

// Get employee by ID
router.get('/employees/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const employee = await dbGet(
      `${employeeSelect}
       WHERE e.id = ?`,
      [req.params.id]
    );
    if (!employee) return res.status(404).json({ error: 'Employee not found' });
    res.json({ data: employee });
  } catch (error) {
    console.error('Error fetching employee:', error);
    res.status(500).json({ error: 'Failed to fetch employee' });
  }
});

// Create employee
router.post('/employees', authMiddleware, async (req: Request, res: Response) => {
  try {
    const employee = normalizeEmployeeBody(req.body);

    if (!employee.code || !employee.name) {
      return res.status(400).json({ error: 'code and name are required' });
    }

    const result = await dbRun(
      `INSERT INTO employees (
         code, name, email, phone, department_id, position, hire_date, status,
         salary, basic_rate, tunjangan_rate, ot_rate, salary_type,
         employment_type, employment_status, contract_start_date, contract_end_date,
         probation_end_date, supervisor_id, payroll_group, work_calendar, work_mode,
         shift_group, roster_anchor_date, site, section, cost_center, grade, notes
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        employee.code, employee.name, employee.email, employee.phone, employee.department_id,
        employee.position, employee.hire_date, employee.status, employee.salary,
        employee.basic_rate, employee.tunjangan_rate, employee.ot_rate, employee.salary_type,
        employee.employment_type, employee.employment_status, employee.contract_start_date,
        employee.contract_end_date, employee.probation_end_date, employee.supervisor_id,
        employee.payroll_group, employee.work_calendar, employee.work_mode, employee.shift_group,
        employee.roster_anchor_date, employee.site, employee.section, employee.cost_center,
        employee.grade, employee.notes,
      ]
    );

    res.status(201).json({
      message: 'Employee created',
      data: { id: result.insertId, code: employee.code, name: employee.name },
    });
  } catch (error: any) {
    console.error('Error creating employee:', error);
    if (error.message?.includes('Duplicate entry')) {
      return res.status(400).json({ error: 'Employee code must be unique' });
    }
    res.status(500).json({ error: 'Failed to create employee' });
  }
});

// Update employee
router.put('/employees/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const employee = normalizeEmployeeBody(req.body);

    await dbRun(
      `UPDATE employees 
       SET name = ?, email = ?, phone = ?, department_id = ?, 
           position = ?, hire_date = ?, status = ?,
           salary = ?, basic_rate = ?, tunjangan_rate = ?, ot_rate = ?, salary_type = ?,
           employment_type = ?, employment_status = ?, contract_start_date = ?, contract_end_date = ?,
           probation_end_date = ?, supervisor_id = ?, payroll_group = ?, work_calendar = ?, work_mode = ?,
           shift_group = ?, roster_anchor_date = ?, site = ?, section = ?, cost_center = ?, grade = ?,
           notes = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        employee.name, employee.email, employee.phone, employee.department_id,
        employee.position, employee.hire_date, employee.status, employee.salary,
        employee.basic_rate, employee.tunjangan_rate, employee.ot_rate, employee.salary_type,
        employee.employment_type, employee.employment_status, employee.contract_start_date,
        employee.contract_end_date, employee.probation_end_date, employee.supervisor_id,
        employee.payroll_group, employee.work_calendar, employee.work_mode, employee.shift_group,
        employee.roster_anchor_date, employee.site, employee.section, employee.cost_center,
        employee.grade, employee.notes,
        req.params.id,
      ]
    );

    res.json({ message: 'Employee updated' });
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({ error: 'Failed to update employee' });
  }
});

// Delete employee
router.delete('/employees/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    await dbRun('DELETE FROM employees WHERE id = ?', [req.params.id]);
    res.json({ message: 'Employee deleted' });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({ error: 'Failed to delete employee' });
  }
});

// ===== SHIFT & ROSTER =====

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function daysBetween(start: Date, current: Date) {
  const startUtc = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const currentUtc = Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate());
  return Math.floor((currentUtc - startUtc) / 86400000);
}

router.get('/shift-definitions', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const shifts = await dbAll(
      `SELECT id, code, name, start_time, end_time, crosses_midnight, paid_hours, color, is_working_day, sort_order, active
         FROM hr_shift_definitions
        WHERE active = 1
        ORDER BY sort_order ASC, code ASC`,
      []
    );
    res.json({ data: shifts });
  } catch (error) {
    console.error('Error fetching shift definitions:', error);
    res.status(500).json({ error: 'Failed to fetch shift definitions' });
  }
});

router.get('/rotation-patterns', authMiddleware, async (req: Request, res: Response) => {
  try {
    const pattern = String(req.query.pattern || 'FACTORY_2222');
    const rows = await dbAll(
      `SELECT pattern_code, group_code, day_index, shift_code
         FROM hr_rotation_patterns
        WHERE pattern_code = ? AND active = 1
        ORDER BY group_code ASC, day_index ASC`,
      [pattern]
    );
    res.json({ data: rows });
  } catch (error) {
    console.error('Error fetching rotation patterns:', error);
    res.status(500).json({ error: 'Failed to fetch rotation patterns' });
  }
});

router.get('/roster/preview', authMiddleware, async (req: Request, res: Response) => {
  try {
    const pattern = String(req.query.pattern || 'FACTORY_2222');
    const startParam = String(req.query.start_date || isoDate(new Date()));
    const days = Math.min(31, Math.max(1, Number(req.query.days) || 14));
    const anchor = new Date(`${String(req.query.anchor_date || '2026-01-01')}T00:00:00Z`);
    const start = new Date(`${startParam}T00:00:00Z`);

    const [employees, shifts, rotations, overrides] = await Promise.all([
      dbAll(
        `SELECT e.id, e.code, e.name, e.position, e.department_id, e.shift_group, e.work_mode, e.site, e.section, e.supervisor_id,
                d.name AS department_name, s.name AS supervisor_name
           FROM employees e
           LEFT JOIN departments d ON d.id = e.department_id
           LEFT JOIN employees s ON s.id = e.supervisor_id
          WHERE UPPER(COALESCE(e.status, 'ACTIVE')) = 'ACTIVE'
          ORDER BY e.shift_group ASC, e.name ASC`,
        []
      ),
      dbAll(
        `SELECT code, name, start_time, end_time, crosses_midnight, paid_hours, color, is_working_day
           FROM hr_shift_definitions
          WHERE active = 1`,
        []
      ),
      dbAll(
        `SELECT group_code, day_index, shift_code
           FROM hr_rotation_patterns
          WHERE pattern_code = ? AND active = 1`,
        [pattern]
      ),
      dbAll(
        `SELECT employee_id, roster_date, shift_code, override_type, reason
           FROM hr_roster_overrides
          WHERE roster_date BETWEEN ? AND ?`,
        [startParam, isoDate(addDays(start, days - 1))]
      ),
    ]);

    const shiftMap = new Map((shifts as any[]).map((shift) => [shift.code, shift]));
    const rotationMap = new Map((rotations as any[]).map((row) => [`${row.group_code}:${row.day_index}`, row.shift_code]));
    const overrideMap = new Map((overrides as any[]).map((row) => [`${row.employee_id}:${isoDate(new Date(row.roster_date))}`, row]));
    const dates = Array.from({ length: days }, (_, index) => isoDate(addDays(start, index)));

    const schedule = dates.map((date) => {
      const current = new Date(`${date}T00:00:00Z`);
      const dayIndex = ((daysBetween(anchor, current) % 8) + 8) % 8;
      const groups = ['A', 'B', 'C', 'D'].map((group) => {
        const shiftCode = rotationMap.get(`${group}:${dayIndex}`) || 'OFF';
        const groupEmployees = (employees as any[]).filter((employee) => employee.work_mode !== 'non_shift' && employee.shift_group === group);
        return {
          group,
          shift_code: shiftCode,
          shift: shiftMap.get(shiftCode) || { code: shiftCode, name: shiftCode },
          employees: groupEmployees.map((employee) => {
            const override = overrideMap.get(`${employee.id}:${date}`) as any;
            const actualShiftCode = override?.shift_code || shiftCode;
            return {
              ...employee,
              planned_shift_code: shiftCode,
              shift_code: actualShiftCode,
              shift: shiftMap.get(actualShiftCode) || shiftMap.get(shiftCode),
              override: override || null,
            };
          }),
        };
      });
      const nonShiftEmployees = (employees as any[]).filter((employee) => employee.work_mode === 'non_shift');
      return {
        date,
        day_index: dayIndex,
        groups,
        non_shift: {
          shift_code: 'REG',
          employees: nonShiftEmployees,
        },
        coverage: groups.reduce((acc, group) => {
          const key = String(group.shift_code || 'OFF');
          acc[key] = (acc[key] || 0) + group.employees.length;
          return acc;
        }, {} as Record<string, number>),
      };
    });

    res.json({
      data: {
        pattern,
        anchor_date: isoDate(anchor),
        start_date: startParam,
        days,
        shifts,
        schedule,
      },
    });
  } catch (error) {
    console.error('Error generating roster preview:', error);
    res.status(500).json({ error: 'Failed to generate roster preview' });
  }
});

// ===== ATTENDANCE =====

router.get('/attendance', authMiddleware, async (req: Request, res: Response) => {
  try {
    const month = Math.min(12, Math.max(1, Number(req.query.month) || new Date().getMonth() + 1));
    const year = Math.min(2200, Math.max(2000, Number(req.query.year) || new Date().getFullYear()));
    const attendance = await dbAll(
      `SELECT a.*, a.date AS attendance_date, a.check_in AS check_in_time, a.check_out AS check_out_time,
              e.name AS employee_name, e.code AS employee_code, e.shift_group, e.work_mode
       FROM attendance_logs a
       LEFT JOIN employees e ON a.employee_id = e.id
       WHERE MONTH(a.date) = ? AND YEAR(a.date) = ?
       ORDER BY a.date DESC, e.name ASC`,
      [month, year]
    );
    res.json({ data: attendance });
  } catch (error) {
    console.error('Error fetching attendance:', error);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});

router.post('/attendance', authMiddleware, async (req: Request, res: Response) => {
  try {
    const rows = Array.isArray(req.body?.logs) ? req.body.logs : [req.body];
    if (!rows.length) return res.status(400).json({ error: 'attendance logs are required' });

    const results = [];
    for (const row of rows) {
      const employeeId = row.employee_id;
      const date = row.date || row.attendance_date;
      if (!employeeId || !date) {
        return res.status(400).json({ error: 'employee_id and date are required' });
      }

      const existing = await dbGet(
        'SELECT id FROM attendance_logs WHERE employee_id = ? AND date = ? LIMIT 1',
        [employeeId, date]
      ) as any;

      if (existing) {
        await dbRun(
          `UPDATE attendance_logs
              SET check_in = ?, check_out = ?, status = ?, notes = ?,
                  timesheet_value = ?, overtime_hours = ?
            WHERE id = ?`,
          [
            row.check_in || row.check_in_time || null,
            row.check_out || row.check_out_time || null,
            row.status || 'present',
            row.notes || null,
            row.timesheet_value ?? 1,
            row.overtime_hours ?? 0,
            existing.id,
          ]
        );
        results.push({ id: existing.id, updated: true });
      } else {
        const result = await dbRun(
          `INSERT INTO attendance_logs (employee_id, date, check_in, check_out, status, notes, timesheet_value, overtime_hours)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            employeeId,
            date,
            row.check_in || row.check_in_time || null,
            row.check_out || row.check_out_time || null,
            row.status || 'present',
            row.notes || null,
            row.timesheet_value ?? 1,
            row.overtime_hours ?? 0,
          ]
        );
        results.push({ id: result.insertId, created: true });
      }
    }

    res.status(201).json({
      message: 'Attendance recorded',
      data: results,
    });
  } catch (error) {
    console.error('Error recording attendance:', error);
    res.status(500).json({ error: 'Failed to record attendance' });
  }
});

router.delete('/attendance/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    await dbRun('DELETE FROM attendance_logs WHERE id = ?', [req.params.id]);
    res.json({ message: 'Attendance deleted' });
  } catch (error) {
    console.error('Error deleting attendance:', error);
    res.status(500).json({ error: 'Failed to delete attendance' });
  }
});

router.get('/attendance/monitor', authMiddleware, async (req: Request, res: Response) => {
  try {
    const month = Math.min(12, Math.max(1, Number(req.query.month) || new Date().getMonth() + 1));
    const year = Math.min(2200, Math.max(2000, Number(req.query.year) || new Date().getFullYear()));
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0));
    const anchor = new Date(`${String(req.query.anchor_date || '2026-01-01')}T00:00:00Z`);
    const pattern = String(req.query.pattern || 'FACTORY_2222');

    const startParam = isoDate(start);
    const endParam = isoDate(end);

    const [employees, shifts, rotations, attendance, requests] = await Promise.all([
      dbAll(
        `SELECT e.id, e.code, e.name, e.position, e.shift_group, e.work_mode, e.site, e.section,
                d.name AS department_name
           FROM employees e
           LEFT JOIN departments d ON d.id = e.department_id
          WHERE UPPER(COALESCE(e.status, 'ACTIVE')) = 'ACTIVE'
          ORDER BY e.name ASC`,
        []
      ),
      dbAll('SELECT code, name, start_time, end_time, is_working_day FROM hr_shift_definitions WHERE active = 1', []),
      dbAll('SELECT group_code, day_index, shift_code FROM hr_rotation_patterns WHERE pattern_code = ? AND active = 1', [pattern]),
      dbAll(
        `SELECT a.*, e.code AS employee_code, e.name AS employee_name
           FROM attendance_logs a
           LEFT JOIN employees e ON e.id = a.employee_id
          WHERE MONTH(a.date) = ? AND YEAR(a.date) = ?`,
        [month, year]
      ),
      dbAll(
        `SELECT id, request_number, employee_id, request_type, start_date, end_date, requested_days, reason, status
           FROM employee_self_service_requests
          WHERE status = 'approved'
            AND request_type IN ('leave', 'permission', 'business_trip')
            AND (
              (start_date BETWEEN ? AND ?)
              OR (end_date BETWEEN ? AND ?)
              OR (start_date <= ? AND end_date >= ?)
            )`,
        [startParam, endParam, startParam, endParam, startParam, endParam]
      ),
    ]);

    const shiftMap = new Map((shifts as any[]).map((shift) => [shift.code, shift]));
    const rotationMap = new Map((rotations as any[]).map((row) => [`${row.group_code}:${row.day_index}`, row.shift_code]));
    const attendanceMap = new Map((attendance as any[]).map((log) => [`${log.employee_id}:${isoDate(new Date(log.date))}`, log]));
    const requestMap = new Map<string, any[]>();
    for (const request of requests as any[]) {
      const reqStart = new Date(`${request.start_date}T00:00:00Z`);
      const reqEnd = new Date(`${request.end_date || request.start_date}T00:00:00Z`);
      for (let cursor = reqStart; cursor <= reqEnd; cursor = addDays(cursor, 1)) {
        const key = `${request.employee_id}:${isoDate(cursor)}`;
        requestMap.set(key, [...(requestMap.get(key) || []), request]);
      }
    }
    const dates = Array.from({ length: end.getUTCDate() }, (_, index) => isoDate(addDays(start, index)));

    const rows = [];
    for (const date of dates) {
      const current = new Date(`${date}T00:00:00Z`);
      const dayIndex = ((daysBetween(anchor, current) % 8) + 8) % 8;
      for (const employee of employees as any[]) {
        const plannedShiftCode = employee.work_mode === 'non_shift' ? 'REG' : (rotationMap.get(`${employee.shift_group}:${dayIndex}`) || 'OFF');
        const plannedShift = shiftMap.get(plannedShiftCode) || { code: plannedShiftCode, name: plannedShiftCode, is_working_day: plannedShiftCode !== 'OFF' };
        const actual = attendanceMap.get(`${employee.id}:${date}`) as any;
        const approvedRequests = requestMap.get(`${employee.id}:${date}`) || [];
        const coverageRequest = approvedRequests[0] || null;
        const status = actual?.status || null;
        const isWorkingDay = plannedShiftCode !== 'OFF' && plannedShiftCode !== 'REG' ? Number((plannedShift as any).is_working_day) === 1 : plannedShiftCode === 'REG';
        const coveredByRequest = !actual && isWorkingDay && !!coverageRequest;
        const exception = coveredByRequest
          ? null
          : !actual && isWorkingDay
          ? 'missing_attendance'
          : actual && plannedShiftCode === 'OFF' && ['present', 'late', 'half-day'].includes(String(status).toLowerCase())
            ? 'worked_on_off_day'
            : actual && String(status).toLowerCase() === 'absent' && isWorkingDay
              ? 'absent'
              : null;

        rows.push({
          date,
          employee_id: employee.id,
          employee_code: employee.code,
          employee_name: employee.name,
          position: employee.position,
          department_name: employee.department_name,
          site: employee.site,
          section: employee.section,
          shift_group: employee.shift_group,
          work_mode: employee.work_mode,
          planned_shift_code: plannedShiftCode,
          planned_shift: plannedShift,
          attendance_id: actual?.id || null,
          status: status || (coveredByRequest ? coverageRequest.request_type : (isWorkingDay ? 'missing' : 'off')),
          check_in: actual?.check_in || null,
          check_out: actual?.check_out || null,
          timesheet_value: actual?.timesheet_value || 0,
          overtime_hours: actual?.overtime_hours || 0,
          gps_verified: actual?.gps_verified || 0,
          notes: actual?.notes || null,
          approved_request: coverageRequest,
          exception,
        });
      }
    }

    res.json({ data: { month, year, rows } });
  } catch (error) {
    console.error('Error fetching attendance monitor:', error);
    res.status(500).json({ error: 'Failed to fetch attendance monitor' });
  }
});

// position rates
router.get('/position-rates', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const rates = await dbAll('SELECT * FROM position_rates ORDER BY position_name ASC', []);
    res.json({ data: rates });
  } catch (error) {
    console.error('Error fetching position rates:', error);
    res.status(500).json({ error: 'Failed to fetch position rates' });
  }
});

router.post('/position-rates', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { position_code, position_name, grade, salary_type, basic_rate, tunjangan_rate, ot_rate, description } = req.body;
    const result = await dbRun(
      'INSERT INTO position_rates (position_code, position_name, grade, salary_type, basic_rate, tunjangan_rate, ot_rate, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [position_code, position_name, grade || null, salary_type || 'daily', basic_rate || 0, tunjangan_rate || 0, ot_rate || 0, description || null]
    );
    res.json({ data: { id: result.insertId }, message: 'Position rate created' });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Position code already exists' });
    console.error('Error creating position rate:', error);
    res.status(500).json({ error: 'Failed to create position rate' });
  }
});

router.put('/position-rates/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { position_code, position_name, grade, salary_type, basic_rate, tunjangan_rate, ot_rate, description, is_active } = req.body;
    await dbRun(
      'UPDATE position_rates SET position_code=?, position_name=?, grade=?, salary_type=?, basic_rate=?, tunjangan_rate=?, ot_rate=?, description=?, is_active=? WHERE id=?',
      [position_code, position_name, grade, salary_type, basic_rate, tunjangan_rate, ot_rate, description, is_active ?? 1, req.params.id]
    );
    res.json({ message: 'Position rate updated' });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Position code already exists' });
    console.error('Error updating position rate:', error);
    res.status(500).json({ error: 'Failed to update position rate' });
  }
});

router.delete('/position-rates/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    await dbRun('DELETE FROM position_rates WHERE id = ?', [req.params.id]);
    res.json({ message: 'Position rate deleted' });
  } catch (error) {
    console.error('Error deleting position rate:', error);
    res.status(500).json({ error: 'Failed to delete position rate' });
  }
});

// salary advances (kasbon)
router.get('/salary-advances', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const advances = await dbAll(`
      SELECT sa.*, e.full_name as employee_name, e.nik as employee_nik
      FROM salary_advances sa
      LEFT JOIN employees e ON sa.employee_id = e.id
      ORDER BY sa.created_at DESC
    `, []);
    res.json({ data: advances });
  } catch (error) {
    console.error('Error fetching salary advances:', error);
    res.status(500).json({ error: 'Failed to fetch salary advances' });
  }
});

router.post('/salary-advances', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { employee_id, amount, description, advance_date, period_month, period_year } = req.body;
    const result = await dbRun(
      'INSERT INTO salary_advances (employee_id, amount, remaining, description, advance_date, period_month, period_year, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [employee_id, amount, amount, description || null, advance_date || new Date().toISOString().slice(0, 10), period_month, period_year, 'pending']
    );
    res.json({ data: { id: result.insertId }, message: 'Salary advance created' });
  } catch (error) {
    console.error('Error creating salary advance:', error);
    res.status(500).json({ error: 'Failed to create salary advance' });
  }
});

router.put('/salary-advances/:id/approve', authMiddleware, async (req: Request, res: Response) => {
  try {
    await dbRun("UPDATE salary_advances SET status = 'approved' WHERE id = ?", [req.params.id]);
    res.json({ message: 'Salary advance approved' });
  } catch (error) {
    console.error('Error approving salary advance:', error);
    res.status(500).json({ error: 'Failed to approve' });
  }
});

// payroll requests
router.get('/payroll-requests', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const requests = await dbAll('SELECT * FROM payroll_requests ORDER BY created_at DESC', []);
    res.json({ data: requests });
  } catch (error) {
    console.error('Error fetching payroll requests:', error);
    res.status(500).json({ error: 'Failed to fetch payroll requests' });
  }
});

router.post('/payroll-requests', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { period_month, period_year } = req.body;
    const userId = (req as any).userId;
    const existing = await dbGet(
      'SELECT id FROM payroll_requests WHERE period_month = ? AND period_year = ?',
      [period_month, period_year]
    );
    if (existing) return res.status(400).json({ error: 'Payroll request for this period already exists' });
    const totals = await dbGet(
      `SELECT COUNT(*) AS employee_count, COALESCE(SUM(net_salary), 0) AS total_amount
         FROM payslip_records
        WHERE period_month = ? AND period_year = ?`,
      [period_month, period_year]
    ) as any;
    const reqNum = `PR-${period_year}${String(period_month).padStart(2, '0')}-${Date.now().toString().slice(-4)}`;
    const result = await dbRun(
      'INSERT INTO payroll_requests (request_number, period_month, period_year, total_amount, employee_count, status, requester_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [reqNum, period_month, period_year, Number(totals?.total_amount || 0), Number(totals?.employee_count || 0), 'draft', userId]
    );
    res.json({ data: { id: result.insertId }, message: 'Payroll request created' });
  } catch (error) {
    console.error('Error creating payroll request:', error);
    res.status(500).json({ error: 'Failed to create payroll request' });
  }
});

router.get('/payroll/workspace', authMiddleware, async (req: Request, res: Response) => {
  try {
    const month = Math.min(12, Math.max(1, Number(req.query.month) || new Date().getMonth() + 1));
    const year = Math.min(2200, Math.max(2000, Number(req.query.year) || new Date().getFullYear()));
    const [calculated, saved, requests] = await Promise.all([
      calculatePayrollRows(month, year),
      dbAll(
        `SELECT pr.*, e.code AS employee_code, e.name AS employee_name
           FROM payslip_records pr
           LEFT JOIN employees e ON e.id = pr.employee_id
          WHERE pr.period_month = ? AND pr.period_year = ?
          ORDER BY e.name ASC`,
        [month, year]
      ),
      dbAll('SELECT * FROM payroll_requests WHERE period_month = ? AND period_year = ? ORDER BY created_at DESC', [month, year]),
    ]);
    res.json({ data: { month, year, calculated, saved, requests } });
  } catch (error) {
    console.error('Error fetching payroll workspace:', error);
    res.status(500).json({ error: 'Failed to fetch payroll workspace' });
  }
});

async function calculatePayrollRows(month: number, year: number) {
  const employees = await dbAll(
    `SELECT e.id, e.code, e.name, e.position, e.salary_type, e.salary, e.basic_rate, e.tunjangan_rate, e.ot_rate,
            e.payroll_group, e.work_mode, e.shift_group, d.name AS department_name
       FROM employees e
       LEFT JOIN departments d ON d.id = e.department_id
      WHERE UPPER(COALESCE(e.status, 'ACTIVE')) = 'ACTIVE'
      ORDER BY e.name ASC`,
    []
  ) as any[];

  const attendance = await dbAll(
    `SELECT employee_id,
            COUNT(*) AS recorded_days,
            SUM(CASE WHEN status IN ('present', 'late', 'half-day', 'leave', 'permission', 'business_trip') THEN COALESCE(timesheet_value, 1) ELSE 0 END) AS payable_days,
            SUM(CASE WHEN status IN ('leave', 'permission', 'business_trip') THEN COALESCE(timesheet_value, 1) ELSE 0 END) AS covered_days,
            SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) AS absent_days,
            SUM(COALESCE(overtime_hours, 0)) AS overtime_hours
       FROM attendance_logs
      WHERE MONTH(date) = ? AND YEAR(date) = ?
      GROUP BY employee_id`,
    [month, year]
  ) as any[];

  const kasbon = await dbAll(
    `SELECT employee_id, COALESCE(SUM(remaining), 0) AS deduction
       FROM salary_advances
      WHERE status = 'approved'
        AND (period_month IS NULL OR period_month = ?)
        AND (period_year IS NULL OR period_year = ?)
      GROUP BY employee_id`,
    [month, year]
  ) as any[];

  const requestRows = await dbAll(
    `SELECT employee_id, request_type, COUNT(*) AS count, COALESCE(SUM(requested_days), 0) AS days, COALESCE(SUM(amount), 0) AS amount
       FROM employee_self_service_requests
      WHERE status = 'approved'
        AND (
          (start_date IS NOT NULL AND MONTH(start_date) = ? AND YEAR(start_date) = ?)
          OR (submitted_at IS NOT NULL AND MONTH(submitted_at) = ? AND YEAR(submitted_at) = ?)
        )
      GROUP BY employee_id, request_type`,
    [month, year, month, year]
  ) as any[];

  const attMap = new Map(attendance.map((row) => [row.employee_id, row]));
  const kasbonMap = new Map(kasbon.map((row) => [row.employee_id, Number(row.deduction || 0)]));
  const requestMap = new Map<string, any>();
  for (const row of requestRows) requestMap.set(`${row.employee_id}:${row.request_type}`, row);

  return employees.map((employee) => {
    const att = attMap.get(employee.id) || {};
    const salaryType = employee.salary_type || 'daily';
    const payableDays = Number(att.payable_days || 0);
    const coveredDays = Number(att.covered_days || 0);
    const absentDays = Number(att.absent_days || 0);
    const overtimeHours = Number(att.overtime_hours || 0);
    const monthlySalary = Number(employee.salary || 0);
    const dailyRate = Number(employee.basic_rate || 0);
    const allowanceRate = Number(employee.tunjangan_rate || 0);
    const otRate = Number(employee.ot_rate || 0);
    const basicPay = salaryType === 'monthly' ? monthlySalary : payableDays * dailyRate;
    const allowancePay = payableDays * allowanceRate;
    const overtimePay = overtimeHours * otRate;
    const grossSalary = basicPay + allowancePay + overtimePay;
    const kasbonDeduction = kasbonMap.get(employee.id) || 0;
    const totalDeductions = kasbonDeduction;
    const netSalary = grossSalary - totalDeductions;
    return {
      employee_id: employee.id,
      employee_code: employee.code,
      employee_name: employee.name,
      department_name: employee.department_name,
      position: employee.position,
      payroll_group: employee.payroll_group,
      salary_type: salaryType,
      working_days: payableDays,
      total_days: payableDays,
      recorded_days: Number(att.recorded_days || 0),
      covered_days: coveredDays,
      absent_days: absentDays,
      total_overtime: overtimeHours,
      total_ot_hours: overtimeHours,
      basic_pay: basicPay,
      basic_salary: basicPay,
      allowance_pay: allowancePay,
      tunjangan: allowancePay,
      overtime_pay: overtimePay,
      ot_pay: overtimePay,
      gross_salary: grossSalary,
      kasbon_deduction: kasbonDeduction,
      advance_1: kasbonDeduction,
      advance_2: 0,
      reimbursement: Number(requestMap.get(`${employee.id}:medical`)?.amount || 0),
      bpjs_kes: 0,
      bpjs_tk: 0,
      pph21: 0,
      total_deductions: totalDeductions,
      net_salary: netSalary,
      trace: {
        recorded_days: Number(att.recorded_days || 0),
        payable_days: payableDays,
        covered_days: coveredDays,
        absent_days: absentDays,
        leave_days: Number(requestMap.get(`${employee.id}:leave`)?.days || 0),
        permission_days: Number(requestMap.get(`${employee.id}:permission`)?.days || 0),
        business_trip_days: Number(requestMap.get(`${employee.id}:business_trip`)?.days || 0),
      },
    };
  });
}

router.get('/payslips/calculate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const month = Math.min(12, Math.max(1, Number(req.query.month) || new Date().getMonth() + 1));
    const year = Math.min(2200, Math.max(2000, Number(req.query.year) || new Date().getFullYear()));
    const rows = await calculatePayrollRows(month, year);
    res.json({ data: rows });
  } catch (error) {
    console.error('Error calculating payslips:', error);
    res.status(500).json({ error: 'Failed to calculate payslips' });
  }
});

router.get('/payslips', authMiddleware, async (req: Request, res: Response) => {
  try {
    const month = Math.min(12, Math.max(1, Number(req.query.month) || new Date().getMonth() + 1));
    const year = Math.min(2200, Math.max(2000, Number(req.query.year) || new Date().getFullYear()));
    const rows = await dbAll(
      `SELECT pr.*, e.code AS employee_code, e.name AS employee_name
         FROM payslip_records pr
         LEFT JOIN employees e ON e.id = pr.employee_id
        WHERE pr.period_month = ? AND pr.period_year = ?
        ORDER BY e.name ASC`,
      [month, year]
    );
    res.json({ data: rows });
  } catch (error) {
    console.error('Error fetching payslips:', error);
    res.status(500).json({ error: 'Failed to fetch payslips' });
  }
});

// save payslips
router.post('/payslips/save', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { period_month, period_year, payslips } = req.body;
    if (!Array.isArray(payslips)) return res.status(400).json({ error: 'payslips array required' });
    let saved = 0;
    for (const ps of payslips) {
      const existing = await dbGet(
        'SELECT id FROM payslip_records WHERE employee_id = ? AND period_month = ? AND period_year = ?',
        [ps.employee_id, period_month, period_year]
      );
      if (existing) {
        await dbRun(`UPDATE payslip_records SET
          total_days=?, total_ot_hours=?, basic_salary=?, tunjangan=?, ot_pay=?,
          gross_salary=?, advance_1=?, advance_2=?, reimbursement=?,
          bpjs_kes=?, bpjs_tk=?, pph21=?, total_deductions=?, net_salary=?, notes=?, project_id=?
          WHERE id=?`, [
          ps.total_days, ps.total_ot_hours, ps.basic_salary, ps.tunjangan, ps.ot_pay,
          ps.gross_salary, ps.advance_1, ps.advance_2, ps.reimbursement,
          ps.bpjs_kes, ps.bpjs_tk, ps.pph21, ps.total_deductions, ps.net_salary,
          ps.notes || null, ps.project_id || null, (existing as any).id
        ]);
      } else {
        await dbRun(`INSERT INTO payslip_records
          (employee_id, period_month, period_year, project_id, total_days, total_ot_hours,
           basic_salary, tunjangan, ot_pay, gross_salary, advance_1, advance_2, reimbursement,
           bpjs_kes, bpjs_tk, pph21, total_deductions, net_salary, notes, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
          ps.employee_id, period_month, period_year, ps.project_id || null,
          ps.total_days, ps.total_ot_hours, ps.basic_salary, ps.tunjangan, ps.ot_pay,
          ps.gross_salary, ps.advance_1, ps.advance_2, ps.reimbursement,
          ps.bpjs_kes, ps.bpjs_tk, ps.pph21, ps.total_deductions, ps.net_salary,
          ps.notes || null, 'draft'
        ]);
      }
      saved++;
    }
    res.json({ message: `${saved} payslips saved` });
  } catch (error) {
    console.error('Error saving payslips:', error);
    res.status(500).json({ error: 'Failed to save payslips' });
  }
});

// mobile portal
router.post('/mobile/login', async (req: Request, res: Response) => {
  try {
    const { nik } = req.body;
    if (!nik) return res.status(400).json({ error: 'NIK is required' });
    const employee = await dbGet(
      'SELECT id, nik, full_name, position, department_id FROM employees WHERE nik = ? AND is_active = 1',
      [nik]
    );
    if (!employee) return res.status(404).json({ error: 'Employee not found' });
    res.json({ data: employee });
  } catch (error) {
    console.error('Error mobile login:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

router.post('/mobile/checkin', async (req: Request, res: Response) => {
  try {
    const { employee_id, gps_lat, gps_lng } = req.body;
    if (!employee_id) return res.status(400).json({ error: 'employee_id is required' });
    const today = new Date().toISOString().slice(0, 10);
    const existing = await dbGet(
      'SELECT id, check_in FROM attendance WHERE employee_id = ? AND date = ?',
      [employee_id, today]
    ) as any;
    const now = new Date().toTimeString().slice(0, 8);
    if (existing && !existing.check_in) {
      await dbRun('UPDATE attendance SET check_in = ?, gps_lat = ?, gps_lng = ? WHERE id = ?',
        [now, gps_lat || null, gps_lng || null, existing.id]);
      res.json({ message: 'Check-in recorded', type: 'checkin' });
    } else if (existing) {
      await dbRun('UPDATE attendance SET check_out = ? WHERE id = ?', [now, existing.id]);
      res.json({ message: 'Check-out recorded', type: 'checkout' });
    } else {
      await dbRun(
        'INSERT INTO attendance (employee_id, date, check_in, gps_lat, gps_lng, status) VALUES (?, ?, ?, ?, ?, ?)',
        [employee_id, today, now, gps_lat || null, gps_lng || null, 'present']
      );
      res.json({ message: 'Check-in recorded', type: 'checkin' });
    }
  } catch (error) {
    console.error('Error mobile checkin:', error);
    res.status(500).json({ error: 'Failed to check in' });
  }
});

export default router;
