import { prisma } from './prisma';
import { logger } from './logger';

export interface AuditActor {
  id?: string | null;
  email?: string | null;
  ip?: string | null;
}

// Global audit trail. Records who/when/before/after for financial, compliance,
// approval, and attendance changes (and anything else that opts in).
export async function audit(params: {
  entity: string;
  entityId: string;
  action: 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'login' | 'restore';
  actor?: AuditActor;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        entity: params.entity,
        entityId: params.entityId,
        action: params.action,
        userId: params.actor?.id ?? null,
        userEmail: params.actor?.email ?? null,
        ip: params.actor?.ip ?? null,
        before: (params.before as any) ?? undefined,
        after: (params.after as any) ?? undefined,
      },
    });
  } catch (err) {
    // Never let audit logging break the request; log and continue.
    logger.error({ err }, 'Failed to write audit log');
  }
}
