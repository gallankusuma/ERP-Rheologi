import { Router, Request, Response } from 'express';
import db from '../config/database';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// GET /api/roles - Get all roles
router.get('/', authMiddleware, (req: Request, res: Response) => {
  try {
    const stmt = db.prepare(`
      SELECT * FROM roles 
      WHERE active = 1 
      ORDER BY level DESC, name ASC
    `);
    const roles = stmt.all();
    res.json({ data: roles });
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

// GET /api/roles/:id - Get specific role with permissions
router.get('/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const stmt = db.prepare('SELECT * FROM roles WHERE id = ?');
    const role = stmt.get(req.params.id);
    
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    // Get permissions for this role
    const permStmt = db.prepare(`
      SELECT p.* FROM permissions p
      INNER JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = ?
      ORDER BY p.module, p.action
    `);
    const permissions = permStmt.all(req.params.id);
    
    res.json({ data: { ...role, permissions } });
  } catch (error) {
    console.error('Error fetching role:', error);
    res.status(500).json({ error: 'Failed to fetch role' });
  }
});

// POST /api/roles - Create role
router.post('/', authMiddleware, (req: Request, res: Response) => {
  try {
    const { code, name, description, level } = req.body;

    if (!code || !name) {
      return res.status(400).json({ error: 'Code and Name are required' });
    }

    const stmt = db.prepare(
      'INSERT INTO roles (code, name, description, level, active) VALUES (?, ?, ?, ?, 1)'
    );
    const result = stmt.run(code, name, description || null, level || 0);

    res.status(201).json({
      message: 'Role created successfully',
      data: { id: result.lastInsertRowid, code, name, description, level, active: true },
    });
  } catch (error) {
    console.error('Error creating role:', error);
    res.status(500).json({ error: 'Failed to create role' });
  }
});

// PUT /api/roles/:id - Update role
router.put('/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const { code, name, description, level, active } = req.body;

    if (!code || !name) {
      return res.status(400).json({ error: 'Code and Name are required' });
    }

    const stmt = db.prepare(
      'UPDATE roles SET code = ?, name = ?, description = ?, level = ?, active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    );
    stmt.run(code, name, description || null, level || 0, active ? 1 : 0, req.params.id);

    res.json({ message: 'Role updated successfully' });
  } catch (error) {
    console.error('Error updating role:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// DELETE /api/roles/:id - Delete role
router.delete('/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const stmt = db.prepare('UPDATE roles SET active = 0 WHERE id = ?');
    stmt.run(req.params.id);

    res.json({ message: 'Role deleted successfully' });
  } catch (error) {
    console.error('Error deleting role:', error);
    res.status(500).json({ error: 'Failed to delete role' });
  }
});

// POST /api/roles/:id/permissions - Assign permissions to role
router.post('/:id/permissions', authMiddleware, (req: Request, res: Response) => {
  try {
    const { permission_ids } = req.body;

    if (!Array.isArray(permission_ids)) {
      return res.status(400).json({ error: 'permission_ids must be an array' });
    }

    // Remove existing permissions
    const deleteStmt = db.prepare('DELETE FROM role_permissions WHERE role_id = ?');
    deleteStmt.run(req.params.id);

    // Add new permissions
    const insertStmt = db.prepare('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
    const assignMany = db.transaction((ids: number[]) => {
      for (const id of ids) {
        insertStmt.run(req.params.id, id);
      }
    });
    assignMany(permission_ids);

    res.json({ message: 'Permissions assigned successfully' });
  } catch (error) {
    console.error('Error assigning permissions:', error);
    res.status(500).json({ error: 'Failed to assign permissions' });
  }
});

export default router;
