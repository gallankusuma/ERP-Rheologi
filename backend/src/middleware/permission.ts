import { Request, Response, NextFunction } from 'express';
import { dbGet } from '../config/database';

/**
 * Check if user has the required permission for a resource action.
 * Checks user role -> role_permissions -> permissions table.
 * Admin (role_id=1) and founder (userLevel>=1) bypass all checks.
 */
export function requirePermission(resource: string, action: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user || !user.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // admin bypass (role_id=1) or founder bypass (userLevel exactly 1)
      if (user.roleId === 1 || user.userLevel === 1) {
        return next();
      }

      const userRecord = await dbGet('SELECT role_id FROM users WHERE id = ?', [user.userId]);
      if (!userRecord) {
        return res.status(403).json({ error: 'User not found' });
      }

      const roleId = userRecord.role_id;

      if (roleId === 1) {
        return next();
      }

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
