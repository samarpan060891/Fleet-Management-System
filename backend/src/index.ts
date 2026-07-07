import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { startAlertScheduler } from './jobs/scheduler';

const app = createApp();

const server = app.listen(env.port, () => {
  logger.info(`Fleet Management API listening on :${env.port} (${env.nodeEnv})`);
  startAlertScheduler();
});

const shutdown = (signal: string) => {
  logger.info(`${signal} received, shutting down`);
  server.close(() => process.exit(0));
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
