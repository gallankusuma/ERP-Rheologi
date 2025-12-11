import { Router, Request, Response } from 'express';
import db from '../config/database';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// GET /api/users - Get all users (admin only)
router.get('/', authMiddleware, (req: Request, res: Response) => {
  try {
    const stmt = db.prepare('SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC');
    const users = stmt.all();
    res.json({ data: users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/users/:id - Get specific user
router.get('/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const stmt = db.prepare('SELECT id, email, name, role, created_at FROM users WHERE id = ?');
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

// GET /api/users/profile/me - Get current user profile
router.get('/profile/me', authMiddleware, (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const stmt = db.prepare('SELECT id, email, name, role, created_at FROM users WHERE id = ?');
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
