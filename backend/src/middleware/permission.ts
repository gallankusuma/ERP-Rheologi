import { Request, Response, NextFunction } from 'express';
import { dbGet } from '../config/database';

/**
 * Check if user has the required permission for a resource action.
 * Admin bypass: role_id=1 or user_level=1 (founder) skip permission checks.
 */
export function requirePermission(resource: string, action: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user || !user.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userRecord = await dbGet(
        'SELECT role_id, user_level FROM users WHERE id = ?',
        [user.userId]
      ) as any;

      if (!userRecord) {
        return res.status(403).json({ error: 'User not found' });
      }

      // admin bypass: founder (user_level=1) or admin role (role_id=1)
      if (userRecord.user_level === 1 || userRecord.role_id === 1) {
        return next();
      }

      if (!userRecord.role_id) {
        return res.status(403).json({ error: 'No role assigned to user' });
      }

      const roleId = userRecord.role_id;

      // check specific permission
      const permission = await dbGet(
        `SELECT rp.id FROM role_permissions rp
         JOIN permissions p ON rp.permission_id = p.id
         WHERE rp.role_id = ? AND p.resource = ? AND p.action = ?`,
        [roleId, resource, action]
      );

      if (permission) {
        return next();
      }

      // check wildcard 'manage' permission
      const wildcardPerm = await dbGet(
        `SELECT rp.id FROM role_permissions rp
         JOIN permissions p ON rp.permission_id = p.id
         WHERE rp.role_id = ? AND p.resource = ? AND p.action = 'manage'`,
        [roleId, resource]
      );

      if (wildcardPerm) {
        return next();
      }

      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: `${resource}:${action}`,
        message: `You don't have permission to ${action} on ${resource}. Contact your administrator.`
      });
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({ error: 'Permission check failed' });
    }
  };
}

/**
 * Helper: check if a user has a specific permission (non-middleware).
 * Returns true/false. Used by approval routes that need conditional logic.
 */
export async function checkUserPermission(userId: number, resource: string, action: string): Promise<boolean> {
  try {
    const userRecord = await dbGet('SELECT role_id FROM users WHERE id = ?', [userId]) as any;
    if (!userRecord || !userRecord.role_id) return false;

    const perm = await dbGet(
      `SELECT rp.id FROM role_permissions rp
       JOIN permissions p ON rp.permission_id = p.id
       WHERE rp.role_id = ? AND p.resource = ? AND (p.action = ? OR p.action = 'manage')`,
      [userRecord.role_id, resource, action]
    );
    return !!perm;
  } catch {
    return false;
  }
}
