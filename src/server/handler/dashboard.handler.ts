import { Hono } from 'hono';
import type { AppEnv } from './app-env.js';
import type { Services } from '../service/services.js';

export function createDashboardRoutes(services: Services): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();
  routes.get('/kpis', async (c) => {
    const kpis = await services.dashboard.getKpis();
    return c.json(kpis);
  });
  return routes;
}
