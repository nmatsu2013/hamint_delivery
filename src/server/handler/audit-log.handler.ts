import { Hono } from 'hono';
import type { AppEnv } from './app-env.js';
import type { Services } from '../service/services.js';
import { parseQuery } from './validation.js';
import { AuditLogQuerySchema } from './dto/query.schemas.js';

export function createAuditLogRoutes(services: Services): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();
  routes.get('/', async (c) => {
    const query = parseQuery(c, AuditLogQuerySchema);
    const result = await services.auditLogs.list(query);
    return c.json(result);
  });
  return routes;
}
