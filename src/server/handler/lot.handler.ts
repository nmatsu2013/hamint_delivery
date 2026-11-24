import { Hono } from 'hono';
import type { AppEnv } from './app-env.js';
import type { Services } from '../service/services.js';
import { parseQuery } from './validation.js';
import { AvailableLotsQuerySchema, TraceQuerySchema } from './dto/query.schemas.js';

export function createLotRoutes(services: Services): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  routes.get('/available', async (c) => {
    const query = parseQuery(c, AvailableLotsQuerySchema);
    const lots = await services.warehouse.listAvailableLots(query.productId);
    return c.json({ items: lots });
  });

  routes.get('/trace', async (c) => {
    const query = parseQuery(c, TraceQuerySchema);
    const deliveries = await services.traceability.traceLot(query.lotNo);
    return c.json({ lotNo: query.lotNo, deliveries });
  });

  return routes;
}
