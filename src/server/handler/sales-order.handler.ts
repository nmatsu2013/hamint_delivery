import { Hono } from 'hono';
import type { AppEnv } from './app-env.js';
import type { Services } from '../service/services.js';
import { parseJson, parseQuery, requireUuid } from './validation.js';
import { SalesOrderListQuerySchema } from './dto/query.schemas.js';
import { CreateSalesOrderSchema } from './dto/request.schemas.js';

export function createSalesOrderRoutes(services: Services): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  routes.get('/', async (c) => {
    const query = parseQuery(c, SalesOrderListQuerySchema);
    const result = await services.salesOrders.list(query);
    return c.json(result);
  });

  routes.get('/:id', async (c) => {
    const id = requireUuid(c.req.param('id'), '受注');
    const result = await services.salesOrders.getFullDetail(id);
    return c.json(result);
  });

  routes.post('/', async (c) => {
    const body = await parseJson(c, CreateSalesOrderSchema);
    const order = await services.salesOrders.createOrder(body, c.get('actor'));
    return c.json(order, 201);
  });

  routes.patch('/:id/cancel', async (c) => {
    const id = requireUuid(c.req.param('id'), '受注');
    const order = await services.salesOrders.cancelOrder(id, c.get('actor'));
    return c.json(order);
  });

  return routes;
}
