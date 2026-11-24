import type { MiddlewareHandler } from 'hono';
import { jwtVerify } from 'jose';
import { UnauthorizedError } from '../../domain/errors/domain.error.js';
import type { Actor } from '../../domain/entities/actor.entity.js';
import type { Env } from '../../config/env.js';
import type { AppEnv } from '../app-env.js';
import { authSecret, SIMPLE_USER_UUID } from '../auth.handler.js';

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

    try {
      const result = await jwtVerify(token, authSecret(env.LOGIN_PASSWORD), {
        issuer: 'hamint-delivery',
        audience: 'hamint-app',
        algorithms: ['HS256'],
      });
      if (result.payload.sub !== SIMPLE_USER_UUID || result.payload.userId !== env.LOGIN_USER_ID) {
        throw new UnauthorizedError('認証トークンが無効です');
      }
      const actor: Actor = {
        id: SIMPLE_USER_UUID,
        userId: env.LOGIN_USER_ID,
        name: env.LOGIN_USER_ID,
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
