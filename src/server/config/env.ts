import 'dotenv/config';
import { z } from 'zod';

const booleanFromString = z
  .union([z.enum(['true', 'false', '1', '0']), z.literal('')])
  .optional()
  .transform((value) => {
    if (value === undefined || value === '') {
      return undefined;
    }
    return value === 'true' || value === '1';
  });

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  CORS_ORIGIN: z.string().default('*'),
  SUPABASE_URL: z.string().url().optional().or(z.literal('')),
  SUPABASE_JWT_SECRET: z.string().optional(),
  ALLOW_DEV_AUTH: booleanFromString,
  BUSINESS_DATE: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal('')),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function loadEnv(): Env {
  if (cached) {
    return cached;
  }
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.flatten().fieldErrors;
    throw new Error(`環境変数の設定が不正です: ${JSON.stringify(details)}`);
  }
  // 開発環境では、明示的に無効化されない限り開発用ログインを許可する。
  // 本番環境（NODE_ENV=production）では明示的に true にしない限り無効。
  if (process.env.ALLOW_DEV_AUTH === undefined) {
    parsed.data.ALLOW_DEV_AUTH = parsed.data.NODE_ENV !== 'production';
  }
  cached = parsed.data;
  return cached;
}

export function resetEnvForTest(): void {
  cached = null;
}
