import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { verifyToken, type AuthPayload } from '../lib/auth.js';

export type AuthedRequest = Request & {
  auth?: AuthPayload;
  userId?: string;
};

export function optionalAuth(
  req: AuthedRequest,
  _res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = verifyToken(header.slice(7));
      req.auth = payload;
      req.userId = payload.sub;
    } catch {
      // ignore invalid token for optional auth
    }
  }
  next();
}

export function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  try {
    const payload = verifyToken(header.slice(7));
    req.auth = payload;
    req.userId = payload.sub;
    return next();
  } catch {
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}

export async function requireAdmin(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  if (!req.auth) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  if (req.auth.role !== 'ADMIN') {
    const user = await prisma.user.findUnique({ where: { id: req.auth.sub } });
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required.' });
    }
  }
  return next();
}
