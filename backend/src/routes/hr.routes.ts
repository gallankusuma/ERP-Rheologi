import express, { Request, Response } from 'express';
import { dbAll, dbGet, dbRun } from '../config/database';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

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
