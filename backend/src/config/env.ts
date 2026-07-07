import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const bool = (v: string | undefined, def = false): boolean => {
  if (v === undefined) return def;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
};

const int = (v: string | undefined, def: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: int(process.env.PORT, 4000),
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  databaseUrl: process.env.DATABASE_URL || '',

  jwtSecret: process.env.JWT_SECRET || 'dev_insecure_secret_change_me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  bcryptRounds: int(process.env.BCRYPT_ROUNDS, 10),

  storage: {
    driver: (process.env.STORAGE_DRIVER || 'local') as 'local' | 's3',
    localDir: path.resolve(process.env.STORAGE_LOCAL_DIR || './uploads'),
    s3: {
      endpoint: process.env.S3_ENDPOINT || '',
      region: process.env.S3_REGION || 'me-central-1',
      bucket: process.env.S3_BUCKET || '',
      accessKey: process.env.S3_ACCESS_KEY || '',
      secretKey: process.env.S3_SECRET_KEY || '',
      forcePathStyle: bool(process.env.S3_FORCE_PATH_STYLE, true),
    },
    maxSizeMb: int(process.env.UPLOAD_MAX_SIZE_MB, 15),
    allowedMime: (process.env.UPLOAD_ALLOWED_MIME ||
      'application/pdf,image/png,image/jpeg,image/webp')
      .split(',')
      .map((s) => s.trim()),
  },

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: int(process.env.SMTP_PORT, 587),
    secure: bool(process.env.SMTP_SECURE, false),
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.SMTP_FROM || 'Fleet Management <no-reply@fleet.local>',
    dryRun: bool(process.env.EMAIL_DRY_RUN, true),
  },

  features: {
    inventory: bool(process.env.FEATURE_INVENTORY, false),
    whatsapp: bool(process.env.FEATURE_WHATSAPP, false),
  },

  alertCron: process.env.ALERT_CRON || '0 6 * * *',
  tz: process.env.TZ || 'Asia/Dubai',

  locale: {
    currency: process.env.DEFAULT_CURRENCY || 'AED',
    locale: process.env.DEFAULT_LOCALE || 'en',
  },

  authRate: {
    windowMs: int(process.env.AUTH_RATE_WINDOW_MS, 15 * 60 * 1000),
    max: int(process.env.AUTH_RATE_MAX, 20),
  },

  seed: {
    adminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@fleet.local',
    adminPassword: process.env.SEED_ADMIN_PASSWORD || 'Admin@123',
  },
};

export type Env = typeof env;
