import { Router, Request, Response } from 'express';
import { dbAll, dbGet, dbRun, dbTransaction } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';

const router = Router();

// GET /api/roles - Get all roles
router.get('/', authMiddleware, requirePermission('system.roles', 'view'), async (req: Request, res: Response) => {
  try {
    const roles = await dbAll('SELECT * FROM roles ORDER BY level DESC, name ASC', []);
    res.json({ data: roles });
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

// GET /api/roles/:id - Get specific role with permissions
router.get('/:id', authMiddleware, requirePermission('system.roles', 'view'), async (req: Request, res: Response) => {
  try {
    const role = await dbGet('SELECT * FROM roles WHERE id = ?', [req.params.id]);
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    // Get permission IDs assigned to this role
    const permissions = await dbAll(`
      SELECT p.id, p.resource, p.action, p.module, p.name, p.description
      FROM permissions p
      INNER JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = ?
      ORDER BY p.module, p.action
    `, [req.params.id]) as any[];

    res.json({ data: { ...role, permissions } });
  } catch (error) {
    console.error('Error fetching role:', error);
    res.status(500).json({ error: 'Failed to fetch role' });
  }
});

// POST /api/roles - Create role
router.post('/', authMiddleware, requirePermission('system.roles', 'create'), async (req: Request, res: Response) => {
  try {
    const { code, name, description, level } = req.body;
    if (!code || !name) {
      return res.status(400).json({ error: 'Code and Name are required' });
    }
    const result = await dbRun(
      'INSERT INTO roles (code, name, description, level, active) VALUES (?, ?, ?, ?, 1)',
      [code, name, description || null, level || 0]
    );
    res.status(201).json({
      message: 'Role created successfully',
      data: { id: result.insertId, code, name, description, level, active: true },
    });
  } catch (error) {
    console.error('Error creating role:', error);
    res.status(500).json({ error: 'Failed to create role' });
  }
});

// PUT /api/roles/:id - Update role
router.put('/:id', authMiddleware, requirePermission('system.roles', 'update'), async (req: Request, res: Response) => {
  try {
    const { code, name, description, level, active } = req.body;
    if (!code || !name) {
      return res.status(400).json({ error: 'Code and Name are required' });
    }
    await dbRun(
      'UPDATE roles SET code = ?, name = ?, description = ?, level = ?, active = ? WHERE id = ?',
      [code, name, description || null, level || 0, active ? 1 : 0, req.params.id]
    );
    res.json({ message: 'Role updated successfully' });
  } catch (error) {
    console.error('Error updating role:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// DELETE /api/roles/:id - Delete role
router.delete('/:id', authMiddleware, requirePermission('system.roles', 'delete'), async (req: Request, res: Response) => {
  try {
    // Don't allow deleting Admin role
    const role = await dbGet('SELECT * FROM roles WHERE id = ?', [req.params.id]) as any;
    if (role && role.code === 'ADM') {
      return res.status(400).json({ error: 'Cannot delete Admin role' });
    }
    await dbRun('DELETE FROM role_permissions WHERE role_id = ?', [req.params.id]);
    await dbRun('DELETE FROM roles WHERE id = ?', [req.params.id]);
    res.json({ message: 'Role deleted successfully' });
  } catch (error) {
    console.error('Error deleting role:', error);
    res.status(500).json({ error: 'Failed to delete role' });
  }
});

// POST /api/roles/:id/permissions - Assign permissions to role
router.post('/:id/permissions', authMiddleware, requirePermission('system.roles', 'assign_permissions'), async (req: Request, res: Response) => {
  try {
    const { permission_ids } = req.body;
    if (!Array.isArray(permission_ids)) {
      return res.status(400).json({ error: 'permission_ids must be an array' });
    }

    const roleId = parseInt(req.params.id, 10);
    if (isNaN(roleId)) {
      return res.status(400).json({ error: 'Invalid role ID' });
    }

    // verify role exists
    const role = await dbGet('SELECT id, name FROM roles WHERE id = ?', [roleId]);
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    await dbTransaction(async (conn) => {
      // validate all permission IDs exist
      if (permission_ids.length > 0) {
        const sanitizedIds = permission_ids.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
        if (sanitizedIds.length !== permission_ids.length) {
          throw new Error('All permission_ids must be valid integers');
        }

        const placeholders = sanitizedIds.map(() => '?').join(',');
        const [validRows] = await conn.execute(
          `SELECT id FROM permissions WHERE id IN (${placeholders})`,
          sanitizedIds
        );
        const validIds = (validRows as any[]).map((r: any) => r.id);
        const invalidIds = sanitizedIds.filter(id => !validIds.includes(id));
        if (invalidIds.length > 0) {
          throw new Error(`Invalid permission IDs: ${invalidIds.join(', ')}`);
        }
      }

      // remove existing permissions
      await conn.execute('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);

      // insert new permissions with parameterized queries
      for (const pid of permission_ids) {
        await conn.execute(
          'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
          [roleId, parseInt(pid, 10)]
        );
      }

      // audit log
      const userId = (req as any).user?.userId || null;
      await conn.execute(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, created_at)
         VALUES (?, 'assign_permissions', 'role', ?, ?, NOW())`,
        [userId, roleId, JSON.stringify({ role: role.name, permission_count: permission_ids.length })]
      );
    });

    res.json({ message: 'Permissions assigned successfully' });
  } catch (error: any) {
    console.error('Error assigning permissions:', error);
    const msg = error.message || 'Failed to assign permissions';
    const status = msg.includes('Invalid permission') || msg.includes('valid integers') ? 400 : 500;
    res.status(status).json({ error: msg });
  }
});

// GET /api/roles/:id/permissions - Get role's permission IDs
router.get('/:id/permissions', authMiddleware, requirePermission('system.roles', 'view'), async (req: Request, res: Response) => {
  try {
    const permissions = await dbAll(
      'SELECT permission_id FROM role_permissions WHERE role_id = ?',
      [req.params.id]
    ) as any[];
    res.json({ data: permissions.map(p => p.permission_id) });
  } catch (error) {
    console.error('Error fetching role permissions:', error);
    res.status(500).json({ error: 'Failed to fetch role permissions' });
  }
});

export default router;
