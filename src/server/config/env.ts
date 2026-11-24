import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  CORS_ORIGIN: z.string().default('*'),
  LOGIN_USER_ID: z.string().min(1).default('hamint_user'),
  LOGIN_PASSWORD: z.string().min(1).default('hamint_password'),
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
  cached = parsed.data;
  return cached;
}

export function resetEnvForTest(): void {
  cached = null;
}
