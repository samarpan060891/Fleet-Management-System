import { Request } from 'express';
import { AuditActor } from './audit';

// Build an audit actor from the authenticated request.
export const actorFrom = (req: Request): AuditActor => ({
  id: req.user?.id ?? null,
  email: req.user?.email ?? null,
  ip: req.ip ?? null,
});

// Standard pagination parsing.
export function paging(query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(query.pageSize) || 25));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function paged<T>(rows: T[], total: number, page: number, pageSize: number) {
  return {
    data: rows,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}
