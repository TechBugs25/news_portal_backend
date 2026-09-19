import { z } from 'zod';

export const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  API_PREFIX: z.string().default('api/v1'),

  // PostgreSQL Configuration (PostgreSQL 18)
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().default(5432),
  DB_USERNAME: z.string().default('postgres'),
  DB_PASSWORD: z.string().default('postgres'),
  DB_DATABASE: z.string().default('news_portal_db'),
  DB_SYNCHRONIZE: z.string().default('true'),
  DB_LOGGING: z.string().default('false'),

  // Redis Configuration
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_TTL_SECONDS: z.coerce.number().default(300),

  // JWT Configuration
  JWT_SECRET: z
    .string()
    .default('super_secret_jwt_key_news_portal_2026_secure'),
  JWT_EXPIRES_IN: z.string().default('1h'),

  // Throttler
  THROTTLE_TTL: z.coerce.number().default(60000),
  THROTTLE_LIMIT: z.coerce.number().default(100),

  // File Uploads
  UPLOAD_DEST: z.string().default('./uploads'),
  MAX_FILE_SIZE_MB: z.coerce.number().default(5),
  ALLOWED_MIME_TYPES: z
    .string()
    .default('image/jpeg,image/png,image/webp,image/gif'),

  // Default Admin Seeding (Configurable via environment, disabled when false)
  AUTO_SEED_ADMIN: z.coerce.boolean().default(true),
  DEFAULT_ADMIN_EMAIL: z.email().default('admin@newsportal.com'),
  DEFAULT_ADMIN_PASSWORD: z.string().min(8).default('AdminPassword123!'),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const errorDetails = result.error.issues
      .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');
    throw new Error(
      `❌ Environment validation failed. Please check your .env configuration:\n${errorDetails}`,
    );
  }

  return result.data;
}
