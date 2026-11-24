import { createHash } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { UnauthorizedError } from '../../domain/errors/domain.error';
import { isRole, type Actor, type Role } from '../../domain/entities/actor.entity';
import type { Env } from '../../config/env';
import type { AppEnv } from '../app-env';

const DEV_USER_IDS: Record<Role, string> = {
  sales: '11111111-1111-4111-8111-111111111111',
  purchasing: '22222222-2222-4222-8222-222222222222',
  warehouse: '33333333-3333-4333-8333-333333333333',
  accounting: '44444444-4444-4444-8444-444444444444',
  admin: '55555555-5555-4555-8555-555555555555',
};

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function resolveRole(payload: Record<string, unknown>): Role {
  const appMetadata = payload.app_metadata as Record<string, unknown> | undefined;
  const userMetadata = payload.user_metadata as Record<string, unknown> | undefined;
  const candidates = [appMetadata?.role, userMetadata?.role, payload.role];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && isRole(candidate)) {
      return candidate;
    }
  }
  // Supabase の既定ロール（authenticated）などは最小権限の営業として扱う。
  return 'sales';
}

function uuidFromString(value: string): string {
  const hex = createHash('sha1').update(value).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function createAuthMiddleware(env: Env): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const header = c.req.header('Authorization');
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedError('認証トークンがありません');
    }
    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedError('認証トークンがありません');
    }

    // 開発用トークン: dev:<role>:<email>
    if (token.startsWith('dev:')) {
      if (!env.ALLOW_DEV_AUTH) {
        throw new UnauthorizedError('開発用トークンは無効です');
      }
      const [, roleValue, email = `${roleValue}@example.com`] = token.split(':');
      if (!roleValue || !isRole(roleValue)) {
        throw new UnauthorizedError('開発用トークンのロールが不正です');
      }
      const actor: Actor = {
        id: DEV_USER_IDS[roleValue],
        email,
        role: roleValue,
        name: `${roleValue} (dev)`,
      };
      c.set('actor', actor);
      await next();
      return;
    }

    try {
      let payload: Record<string, unknown>;
      if (env.SUPABASE_JWT_SECRET) {
        const result = await jwtVerify(
          token,
          new TextEncoder().encode(env.SUPABASE_JWT_SECRET),
        );
        payload = result.payload as Record<string, unknown>;
      } else if (env.SUPABASE_URL) {
        jwks ??= createRemoteJWKSet(
          new URL(`${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json`),
        );
        const result = await jwtVerify(token, jwks, {
          issuer: `${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1`,
          audience: 'authenticated',
        });
        payload = result.payload as Record<string, unknown>;
      } else {
        throw new UnauthorizedError(
          'Supabaseの認証設定（SUPABASE_URL / SUPABASE_JWT_SECRET）がありません',
        );
      }

      const subject = typeof payload.sub === 'string' ? payload.sub : '';
      if (!subject) {
        throw new UnauthorizedError('トークンにsubがありません');
      }
      const email = typeof payload.email === 'string' ? payload.email : '';
      const actor: Actor = {
        id: /^[0-9a-f-]{36}$/i.test(subject) ? subject : uuidFromString(subject),
        email,
        role: resolveRole(payload),
      };
      c.set('actor', actor);
      await next();
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        throw error;
      }
      throw new UnauthorizedError('認証トークンが無効です');
    }
  };
}
