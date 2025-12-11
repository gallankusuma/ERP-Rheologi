import { Router, Request, Response } from 'express';
import db from '../config/database';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// GET /api/users - Get all users with department & role info
router.get('/', authMiddleware, (req: Request, res: Response) => {
  try {
    const stmt = db.prepare(`
      SELECT u.id, u.email, u.name, u.phone, u.is_active, u.user_level,
             d.name as department_name, d.code as department_code,
             r.name as role_name, r.code as role_code,
             u.created_at
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id != 'admin@example.com'
      ORDER BY d.name, r.level DESC, u.name ASC
    `);
    const users = stmt.all();
    res.json({ data: users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/users/:id - Get specific user with full details
router.get('/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const stmt = db.prepare(`
      SELECT u.id, u.email, u.name, u.phone, u.address, u.is_active, u.user_level, u.last_login,
             u.department_id, d.name as department_name, d.code as department_code,
             u.role_id, r.name as role_name, r.code as role_code,
             u.created_at, u.updated_at
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = ?
    `);
    const user = stmt.get(req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ data: user });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// GET /api/users/profile/me - Get current user profile with all details
router.get('/profile/me', authMiddleware, (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const stmt = db.prepare(`
      SELECT u.id, u.email, u.name, u.phone, u.address, u.is_active, u.user_level, u.last_login,
             u.department_id, d.name as department_name, d.code as department_code,
             u.role_id, r.name as role_name, r.code as role_code,
             u.created_at, u.updated_at
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = ?
    `);
    const user = stmt.get(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ data: user });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

export default router;
