// Typed application errors mapped to HTTP status codes by the error handler.
export class AppError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const BadRequest = (msg: string, details?: unknown) =>
  new AppError(400, 'BAD_REQUEST', msg, details);
export const Unauthorized = (msg = 'Authentication required') =>
  new AppError(401, 'UNAUTHORIZED', msg);
export const Forbidden = (msg = 'You do not have permission to perform this action') =>
  new AppError(403, 'FORBIDDEN', msg);
export const NotFound = (msg = 'Resource not found') =>
  new AppError(404, 'NOT_FOUND', msg);
export const Conflict = (msg: string) => new AppError(409, 'CONFLICT', msg);
