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

export default router;
