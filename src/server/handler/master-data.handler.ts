import { Hono } from 'hono';
import type { AppEnv } from './app-env.js';
import type { Services } from '../service/services.js';
import { parseQuery, requireUuid } from './validation.js';
import { PriceResolveQuerySchema } from './dto/query.schemas.js';

export function createMasterDataRoutes(services: Services): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  routes.get('/customers', async (c) => {
    return c.json({ items: await services.masterData.listCustomers() });
  });

  routes.get('/customers/:id/addresses', async (c) => {
    const id = requireUuid(c.req.param('id'), '顧客');
    return c.json({ items: await services.masterData.listCustomerAddresses(id) });
  });

  routes.get('/products', async (c) => {
    return c.json({ items: await services.masterData.listProducts() });
  });

  routes.get('/prices/resolve', async (c) => {
    const query = parseQuery(c, PriceResolveQuerySchema);
    const result = await services.masterData.resolvePrice(
      query.customerId,
      query.productId,
      query.date,
    );
    return c.json(result);
  });

  return routes;
}
