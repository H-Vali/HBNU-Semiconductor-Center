import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export type Role = 'USER' | 'MANAGER' | 'ADMIN';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

const jwtSecret = process.env.JWT_SECRET ?? 'local-dev-secret';

export function signToken(user: SessionUser) {
  return jwt.sign(user, jwtSecret, { expiresIn: '8h' });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    req.user = jwt.verify(token, jwtSecret) as SessionUser;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired session' });
  }
}

export function requireRole(roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permission' });
    }
    next();
  };
}
