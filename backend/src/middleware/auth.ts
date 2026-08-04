import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { dbGet } from '../config/database';

interface AuthRequest extends Request {
  userId?: number;
  user?: any;
}

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
    
    // Load role_id from database to ensure accurate permission checks
    // JWT only contains userId and userLevel — role_id must come from DB
    let roleId = null;
    try {
      const userRecord = await dbGet('SELECT role_id FROM users WHERE id = ?', [decoded.userId]);
      roleId = userRecord?.role_id || null;
    } catch {
      // If DB lookup fails, continue with null roleId (non-admin)
    }

    req.userId = decoded.userId;
    req.user = {
      userId: decoded.userId,
      userLevel: decoded.userLevel,
      roleId: roleId,
    };
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

export const generateToken = (userId: number, userLevel?: number) => {
  return jwt.sign(
    { userId, userLevel },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
  );
};
