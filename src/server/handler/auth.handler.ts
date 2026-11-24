import { Hono } from 'hono';
import { createHash, timingSafeEqual } from 'node:crypto';
import { SignJWT } from 'jose';
import { z } from 'zod';
import type { Env } from '../config/env.js';
import type { AppEnv } from './app-env.js';
import { parseJson } from './validation.js';
import { UnauthorizedError } from '../domain/errors/domain.error.js';

const LoginSchema = z.object({
  userId: z.string().min(1),
  password: z.string().min(1),
});

export const SIMPLE_USER_UUID = '55555555-5555-4555-8555-555555555555';

export function authSecret(password: string): Uint8Array {
  return createHash('sha256').update(password).digest();
}

function matches(actual: string, expected: string): boolean {
  const actualHash = createHash('sha256').update(actual).digest();
  const expectedHash = createHash('sha256').update(expected).digest();
  return timingSafeEqual(actualHash, expectedHash);
}

export function createAuthRoutes(): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  routes.get('/me', (c) => {
    const actor = c.get('actor');
    return c.json({
      id: actor.id,
      userId: actor.userId,
      name: actor.name ?? actor.userId,
    });
  });

  return routes;
}

/** 固定ユーザーID・パスワードを検証する簡易ログイン。 */
export function createLoginRoute(env: Env): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  routes.post('/login', async (c) => {
    const body = await parseJson(c, LoginSchema);
    if (!matches(body.userId, env.LOGIN_USER_ID) || !matches(body.password, env.LOGIN_PASSWORD)) {
      throw new UnauthorizedError('ユーザーIDまたはパスワードが正しくありません');
    }

    const token = await new SignJWT({ userId: env.LOGIN_USER_ID })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(SIMPLE_USER_UUID)
      .setIssuer('hamint-delivery')
      .setAudience('hamint-app')
      .setIssuedAt()
      .setExpirationTime('12h')
      .sign(authSecret(env.LOGIN_PASSWORD));

    return c.json({
      token,
      actor: {
        id: SIMPLE_USER_UUID,
        userId: env.LOGIN_USER_ID,
        name: env.LOGIN_USER_ID,
      },
    });
  });

  return routes;
}
