import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../lib/auth';
import { Unauthorized } from '../lib/errors';

// Verifies the Bearer JWT and attaches req.user.
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(Unauthorized());
  }
  const token = header.slice('Bearer '.length);
  try {
    const payload = verifyToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      driverId: payload.driverId ?? null,
    };
    next();
  } catch {
    next(Unauthorized('Invalid or expired token'));
  }
}
