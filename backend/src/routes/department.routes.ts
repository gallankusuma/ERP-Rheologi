import { Router, Request, Response } from 'express';
import db from '../config/database';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// GET /api/departments - Get all departments
router.get('/', authMiddleware, (req: Request, res: Response) => {
  try {
    const stmt = db.prepare(`
      SELECT d.*, u.name as head_user_name 
      FROM departments d 
      LEFT JOIN users u ON d.head_user_id = u.id 
      WHERE d.active = 1 
      ORDER BY d.name ASC
    `);
    const departments = stmt.all();
    res.json({ data: departments });
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

// GET /api/departments/:id - Get specific department with users
router.get('/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const stmt = db.prepare(`
      SELECT d.*, u.name as head_user_name 
      FROM departments d 
      LEFT JOIN users u ON d.head_user_id = u.id 
      WHERE d.id = ?
    `);
    const department = stmt.get(req.params.id);
    
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }

    // Get users in this department
    const usersStmt = db.prepare(`
      SELECT u.id, u.name, u.email, r.name as role_name, u.user_level, u.is_active
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.department_id = ?
      ORDER BY u.name ASC
    `);
    const users = usersStmt.all(req.params.id);
    
    res.json({ data: { ...department, users } });
  } catch (error) {
    console.error('Error fetching department:', error);
    res.status(500).json({ error: 'Failed to fetch department' });
  }
});

// POST /api/departments - Create department
router.post('/', authMiddleware, (req: Request, res: Response) => {
  try {
    const { code, name, description } = req.body;

    if (!code || !name) {
      return res.status(400).json({ error: 'Code and Name are required' });
    }

    const stmt = db.prepare(
      'INSERT INTO departments (code, name, description, active) VALUES (?, ?, ?, 1)'
    );
    const result = stmt.run(code, name, description || null);

    res.status(201).json({
      message: 'Department created successfully',
      data: { id: result.lastInsertRowid, code, name, description, active: true },
    });
  } catch (error) {
    console.error('Error creating department:', error);
    res.status(500).json({ error: 'Failed to create department' });
  }
});

// PUT /api/departments/:id - Update department
router.put('/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const { code, name, description, head_user_id, active } = req.body;

    if (!code || !name) {
      return res.status(400).json({ error: 'Code and Name are required' });
    }

    const stmt = db.prepare(
      'UPDATE departments SET code = ?, name = ?, description = ?, head_user_id = ?, active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    );
    stmt.run(code, name, description || null, head_user_id || null, active ? 1 : 0, req.params.id);

    res.json({ message: 'Department updated successfully' });
  } catch (error) {
    console.error('Error updating department:', error);
    res.status(500).json({ error: 'Failed to update department' });
  }
});

// DELETE /api/departments/:id - Delete department
router.delete('/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const stmt = db.prepare('UPDATE departments SET active = 0 WHERE id = ?');
    stmt.run(req.params.id);

    res.json({ message: 'Department deleted successfully' });
  } catch (error) {
    console.error('Error deleting department:', error);
    res.status(500).json({ error: 'Failed to delete department' });
  }
});

export default router;
