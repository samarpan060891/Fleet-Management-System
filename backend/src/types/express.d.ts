import { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      // Populated by the auth middleware after JWT verification.
      user?: {
        id: string;
        email: string;
        role: Role;
        driverId?: string | null;
      };
    }
  }
}

export {};
