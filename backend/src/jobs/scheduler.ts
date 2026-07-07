import cron from 'node-cron';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { runAlertEngine } from '../modules/alerts/alerts.engine';

// Schedules the daily alert-engine evaluation. Cron + timezone from env.
export function startAlertScheduler(): void {
  if (process.env.DISABLE_SCHEDULER === 'true') return;
  if (!cron.validate(env.alertCron)) {
    logger.warn({ cron: env.alertCron }, 'Invalid ALERT_CRON; scheduler not started');
    return;
  }
  cron.schedule(
    env.alertCron,
    async () => {
      logger.info('Running scheduled alert engine');
      try {
        await runAlertEngine();
      } catch (err) {
        logger.error({ err }, 'Scheduled alert engine failed');
      }
    },
    { timezone: env.tz }
  );
  logger.info({ cron: env.alertCron, tz: env.tz }, 'Alert scheduler started');
}
