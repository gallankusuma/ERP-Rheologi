import { Request, Response, NextFunction } from 'express';
import { dbGet } from '../config/database';

/**
 * Authorization middleware that checks if the current user has the required permission.
 * 
 * Usage:
 *   router.post('/workorders', authMiddleware, requirePermission('production.workorders', 'create'), handler);
 *   router.put('/workorders/:id/status', authMiddleware, requirePermission('production.workorders', 'update'), handler);
 * 
 * Checks: user's role → role_permissions → permissions table
 * Super-admin (role_id=1) bypasses all permission checks.
 */
export function requirePermission(resource: string, action: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user || !user.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Super admin (role_id = 1 OR userLevel = 1) bypasses all permission checks
      // userLevel=1 covers founder accounts that may have role_id=NULL (Accepted Owner Risk)
      if (user.roleId === 1 || user.userLevel === 1) {
        return next();
      }

      // Look up the user's role and check if they have the required permission
      const userRecord = await dbGet('SELECT role_id FROM users WHERE id = ?', [user.userId]);
      if (!userRecord) {
        return res.status(403).json({ error: 'User not found' });
      }

      const roleId = userRecord.role_id;

      // Super admin role always passes
      if (roleId === 1) {
        return next();
      }

      // Check permission via role_permissions join
      const permission = await dbGet(
        `SELECT rp.id FROM role_permissions rp
         JOIN permissions p ON rp.permission_id = p.id
         WHERE rp.role_id = ? AND p.resource = ? AND p.action = ?`,
        [roleId, resource, action]
      );

      if (permission) {
        return next();
      }

      // Also check for wildcard action (some roles have 'manage' which covers all actions)
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
