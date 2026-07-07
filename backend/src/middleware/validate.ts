import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodTypeAny } from 'zod';

// Validates and coerces req.body/query/params against zod schemas.
export function validate(schemas: {
  body?: ZodTypeAny;
  query?: AnyZodObject;
  params?: AnyZodObject;
}) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) Object.assign(req.query, schemas.query.parse(req.query));
      if (schemas.params) Object.assign(req.params, schemas.params.parse(req.params));
      next();
    } catch (err) {
      next(err);
    }
  };
}
