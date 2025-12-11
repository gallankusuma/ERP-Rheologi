import express, { Request, Response } from 'express';
import { getDatabase } from '../config/database';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

// GET /permissions - Get all permissions
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const permissions = db.prepare('SELECT * FROM permissions WHERE active = 1 ORDER BY module, action').all();
    
    res.json({
      success: true,
      data: permissions,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /permissions/:id - Get permission by ID
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const permission = db.prepare('SELECT * FROM permissions WHERE id = ?').get(req.params.id);
    
    if (!permission) {
      return res.status(404).json({
        success: false,
        error: 'Permission not found',
      });
    }
    
    res.json({
      success: true,
      data: permission,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// POST /permissions - Create new permission
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { code, name, module, action, description } = req.body;
    
    if (!code || !name || !module || !action) {
      return res.status(400).json({
        success: false,
        error: 'Code, name, module, and action are required',
      });
    }
    
    const db = getDatabase();
    const result = db.prepare(
      'INSERT INTO permissions (code, name, module, action, description, active) VALUES (?, ?, ?, ?, ?, 1)'
    ).run(code, name, module, action, description || null);
    
    res.json({
      success: true,
      data: { id: result.lastInsertRowid, code, name, module, action, description },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// PUT /permissions/:id - Update permission
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { code, name, module, action, description, active } = req.body;
    
    const db = getDatabase();
    db.prepare(
      'UPDATE permissions SET code = ?, name = ?, module = ?, action = ?, description = ?, active = ? WHERE id = ?'
    ).run(code, name, module, action, description, active, req.params.id);
    
    res.json({
      success: true,
      data: { id: req.params.id, code, name, module, action, description, active },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// DELETE /permissions/:id - Delete permission (soft delete)
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    db.prepare('UPDATE permissions SET active = 0 WHERE id = ?').run(req.params.id);
    
    res.json({
      success: true,
      message: 'Permission deleted successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
