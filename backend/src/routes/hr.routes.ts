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

    const type = String(req.body?.request_type || '') as EssRequestType;
    const startDate = req.body?.start_date || null;
    const endDate = req.body?.end_date || startDate || null;
    const reason = String(req.body?.reason || '').trim();
    const amount = req.body?.amount === '' || req.body?.amount == null ? null : Number(req.body.amount);
    const destination = String(req.body?.destination || '').trim() || null;
    const notes = String(req.body?.notes || '').trim() || null;

    if (!ESS_REQUEST_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Unsupported request type' });
    }
    if (!reason) return res.status(400).json({ error: 'Reason is required' });
    if (type !== 'medical' && (!startDate || !endDate)) {
      return res.status(400).json({ error: 'Start and end date are required' });
    }
    if (startDate && endDate && !inclusiveDays(startDate, endDate)) {
      return res.status(400).json({ error: 'End date must be on or after start date' });
    }
    if (type === 'medical' && (!amount || amount <= 0)) {
      return res.status(400).json({ error: 'Medical claim amount must be greater than zero' });
    }
    if (type === 'business_trip' && !destination) {
      return res.status(400).json({ error: 'Destination is required for a business trip' });
    }

    const number = requestNumber(type);
    const result = await dbRun(
      `INSERT INTO employee_self_service_requests
        (request_number, employee_id, request_type, start_date, end_date,
         requested_days, amount, destination, reason, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted')`,
      [
        number,
        employee.id,
        type,
        startDate,
        endDate,
        inclusiveDays(startDate, endDate),
        amount,
        destination,
        reason,
        notes,
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

// ===== EMPLOYEES (HR LITE) =====

// Get all employees
router.get('/employees', authMiddleware, async (req: Request, res: Response) => {
  try {
    const employees = await dbAll(
      `SELECT e.*, d.name as department_name
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
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
      `SELECT e.*, d.name as department_name
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
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
    const {
      code,
      name,
      email,
      phone,
      department_id,
      role_id,
      position,
      hire_date,
      is_active,
    } = req.body;

    if (!code || !name) {
      return res.status(400).json({ error: 'code and name are required' });
    }

    const result = await dbRun(
      `INSERT INTO employees (code, name, email, phone, department_id, position, hire_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        code,
        name,
        email || null,
        phone || null,
        department_id || null,
        position || null,
        hire_date || null,
        is_active !== undefined ? (is_active ? 'ACTIVE' : 'INACTIVE') : 'ACTIVE',
      ]
    );

    res.status(201).json({
      message: 'Employee created',
      data: { id: result.insertId, code, name },
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
    const {
      name,
      email,
      phone,
      department_id,
      position,
      hire_date,
      is_active,
    } = req.body;

    await dbRun(
      `UPDATE employees 
       SET name = ?, email = ?, phone = ?, department_id = ?, 
           position = ?, hire_date = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        name,
        email || null,
        phone || null,
        department_id || null,
        position || null,
        hire_date || null,
        is_active !== undefined ? (is_active ? 'ACTIVE' : 'INACTIVE') : 'ACTIVE',
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

// ===== ATTENDANCE =====

router.get('/attendance', authMiddleware, async (req: Request, res: Response) => {
  try {
    const attendance = await dbAll(
      `SELECT a.*, e.name as employee_name, e.code as employee_code
       FROM attendance_logs a
       LEFT JOIN employees e ON a.employee_id = e.id
       ORDER BY a.attendance_date DESC`,
      []
    );
    res.json({ data: attendance });
  } catch (error) {
    console.error('Error fetching attendance:', error);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});

router.post('/attendance', authMiddleware, async (req: Request, res: Response) => {
  try {
    const {
      employee_id,
      attendance_date,
      check_in_time,
      check_out_time,
      status,
      notes,
    } = req.body;

    if (!employee_id || !attendance_date) {
      return res
        .status(400)
        .json({ error: 'employee_id and attendance_date are required' });
    }

    const result = await dbRun(
      `INSERT INTO attendance_logs (employee_id, attendance_date, check_in_time, check_out_time, status, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        employee_id,
        attendance_date,
        check_in_time || null,
        check_out_time || null,
        status || 'present',
        notes || null,
      ]
    );

    res.status(201).json({
      message: 'Attendance recorded',
      data: { id: result.insertId },
    });
  } catch (error) {
    console.error('Error recording attendance:', error);
    res.status(500).json({ error: 'Failed to record attendance' });
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
    const reqNum = `PR-${period_year}${String(period_month).padStart(2, '0')}-${Date.now().toString().slice(-4)}`;
    const result = await dbRun(
      'INSERT INTO payroll_requests (request_number, period_month, period_year, status, requester_id) VALUES (?, ?, ?, ?, ?)',
      [reqNum, period_month, period_year, 'draft', userId]
    );
    res.json({ data: { id: result.insertId }, message: 'Payroll request created' });
  } catch (error) {
    console.error('Error creating payroll request:', error);
    res.status(500).json({ error: 'Failed to create payroll request' });
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
