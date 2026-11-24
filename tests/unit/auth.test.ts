import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import type { Env } from '../../src/server/config/env';
import type { AppEnv } from '../../src/server/handler/app-env';
import { createAuthRoutes, createLoginRoute } from '../../src/server/handler/auth.handler';
import { createAuthMiddleware } from '../../src/server/handler/middleware/auth.middleware';
import { handleError } from '../../src/server/handler/middleware/error-handler';

const env: Env = {
  NODE_ENV: 'test',
  PORT: 3000,
  DATABASE_URL: 'postgresql://localhost/test',
  CORS_ORIGIN: '*',
  LOGIN_USER_ID: 'hamint_user',
  LOGIN_PASSWORD: 'hamint_password',
};

function createTestApp() {
  const app = new Hono<AppEnv>();
  app.onError(handleError);
  app.route('/api/auth', createLoginRoute(env));
  app.use('/api/*', createAuthMiddleware(env));
  app.route('/api', createAuthRoutes());
  return app;
}

describe('simple authentication', () => {
  it('logs in with the configured user ID and password', async () => {
    const app = createTestApp();
    const login = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'hamint_user', password: 'hamint_password' }),
    });

    expect(login.status).toBe(200);
    const session = (await login.json()) as {
      token: string;
      actor: { userId: string; role?: string };
    };
    expect(session.token).toBeTruthy();
    expect(session.actor).toEqual(
      expect.objectContaining({ userId: 'hamint_user', name: 'hamint_user' }),
    );
    expect(session.actor).not.toHaveProperty('role');

    const me = await app.request('/api/me', {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    expect(me.status).toBe(200);
    await expect(me.json()).resolves.toEqual(
      expect.objectContaining({ userId: 'hamint_user', name: 'hamint_user' }),
    );
  });

  it('rejects an incorrect password', async () => {
    const app = createTestApp();
    const response = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'hamint_user', password: 'wrong' }),
    });

    expect(response.status).toBe(401);
  });
});
