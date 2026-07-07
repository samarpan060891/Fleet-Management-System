import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { env } from './config/env';
import { authenticate } from './middleware/authenticate';
import { errorHandler } from './middleware/errorHandler';
import { NotFound } from './lib/errors';
import { apiRouter } from './routes';
import { authRouter } from './modules/auth/auth.routes';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigins.length ? env.corsOrigins : true,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Health check (unauthenticated).
  app.get('/api/health', (_req, res) =>
    res.json({ status: 'ok', time: new Date().toISOString(), features: env.features })
  );

  // Auth endpoints with rate limiting.
  const authLimiter = rateLimit({
    windowMs: env.authRate.windowMs,
    max: env.authRate.max,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/auth', authLimiter, authRouter);

  // All other API routes require authentication.
  app.use('/api', authenticate, apiRouter);

  // Serve uploaded files (local storage) to authenticated users.
  if (env.storage.driver === 'local') {
    app.use(
      '/files',
      authenticate,
      express.static(path.resolve(env.storage.localDir), { fallthrough: true })
    );
  }

  app.use((_req, _res, next) => next(NotFound('Route not found')));
  app.use(errorHandler);

  return app;
}
