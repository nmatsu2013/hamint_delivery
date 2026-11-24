import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../config/env';
import { isRole, ROLE_LABEL } from '../domain/entities/actor.entity';
import type { AppEnv } from './app-env';
import { parseJson } from './validation';
import { ValidationError } from '../domain/errors/domain.error';

const DevLoginSchema = z.object({
  role: z.enum(['sales', 'purchasing', 'warehouse', 'accounting', 'admin']),
  email: z.string().email().optional(),
});

export function createAuthRoutes(): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  routes.get('/me', (c) => {
    const actor = c.get('actor');
    return c.json({
      id: actor.id,
      email: actor.email,
      role: actor.role,
      roleLabel: ROLE_LABEL[actor.role],
      name: actor.name ?? actor.email,
    });
  });

  return routes;
}

/** 認証不要の開発用ログイン。ALLOW_DEV_AUTH=true のときだけ有効。 */
export function createDevLoginRoute(env: Env): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  routes.post('/dev-login', async (c) => {
    if (!env.ALLOW_DEV_AUTH) {
      throw new ValidationError('開発用ログインは無効です');
    }
    const body = await parseJson(c, DevLoginSchema);
    if (!isRole(body.role)) {
      throw new ValidationError('ロールが不正です');
    }
    const email = body.email ?? `${body.role}@example.com`;
    return c.json({
      token: `dev:${body.role}:${email}`,
      actor: {
        email,
        role: body.role,
        roleLabel: ROLE_LABEL[body.role],
      },
    });
  });

  return routes;
}
