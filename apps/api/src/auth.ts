import type { NextFunction, Request, Response } from 'express';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config();

export type Role = 'USER' | 'MANAGER' | 'ADMIN';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface RegistrationProfile {
  googleSubject: string;
  email: string;
  name: string;
  provider: 'Google';
}

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

export const isProductionRuntime = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret && isProductionRuntime) {
  throw new Error('JWT_SECRET required');
}
const signingSecret = jwtSecret ?? 'local-dev-secret';

export function signToken(user: SessionUser) {
  return jwt.sign(user, signingSecret, { expiresIn: '8h' });
}

export function signRegistrationToken(profile: RegistrationProfile) {
  return jwt.sign({ type: 'registration', ...profile }, signingSecret, { expiresIn: '30m' });
}

export function verifyRegistrationToken(token: string) {
  const payload = jwt.verify(token, signingSecret) as RegistrationProfile & { type?: string };
  if (payload.type !== 'registration') {
    throw new Error('Invalid registration token');
  }
  return payload;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  let tokenUser: SessionUser;
  try {
    tokenUser = jwt.verify(token, signingSecret) as SessionUser;
  } catch {
    return res.status(401).json({ message: 'Invalid or expired session' });
  }

  try {
    const { getCurrentAuthSession } = await import('./users.js');
    const session = await getCurrentAuthSession(tokenUser);
    if (!session) return res.status(401).json({ message: 'Invalid or expired session' });
    req.user = session.user;
    return next();
  } catch (error) {
    return next(error);
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
