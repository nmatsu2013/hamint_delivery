import { Hono } from 'hono';
import type { AppEnv } from './app-env';
import type { Services } from '../service/services';
import { authorize } from './middleware/authorize.middleware';
import { parseQuery } from './validation';
import { AvailableLotsQuerySchema, TraceQuerySchema } from './dto/query.schemas';

export function createLotRoutes(services: Services): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  routes.get('/available', authorize('warehouse', 'admin'), async (c) => {
    const query = parseQuery(c, AvailableLotsQuerySchema);
    const lots = await services.warehouse.listAvailableLots(query.productId);
    return c.json({ items: lots });
  });

  routes.get('/trace', authorize('warehouse', 'accounting', 'admin'), async (c) => {
    const query = parseQuery(c, TraceQuerySchema);
    const deliveries = await services.traceability.traceLot(query.lotNo);
    return c.json({ lotNo: query.lotNo, deliveries });
  });

  return routes;
}
