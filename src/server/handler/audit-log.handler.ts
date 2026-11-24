import { Hono } from 'hono';
import type { AppEnv } from './app-env';
import type { Services } from '../service/services';
import { authorize } from './middleware/authorize.middleware';
import { parseQuery } from './validation';
import { AuditLogQuerySchema } from './dto/query.schemas';

export function createAuditLogRoutes(services: Services): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();
  routes.get('/', authorize('admin'), async (c) => {
    const query = parseQuery(c, AuditLogQuerySchema);
    const result = await services.auditLogs.list(query);
    return c.json(result);
  });
  return routes;
}
