import { Request, Response, NextFunction } from 'express';
import { Action, Resource, roleCan } from '../config/permissions';
import { Forbidden, Unauthorized } from '../lib/errors';

// RBAC guard driven by the central permissions matrix.
// Usage: router.post('/', authorize('fuel', 'create'), handler)
export function authorize(resource: Resource, action: Action) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(Unauthorized());
    if (!roleCan(req.user.role, resource, action)) {
      return next(Forbidden());
    }
    next();
  };
}
