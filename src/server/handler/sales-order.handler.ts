import { Hono } from 'hono';
import type { AppEnv } from './app-env';
import type { Services } from '../service/services';
import { authorize } from './middleware/authorize.middleware';
import { maskForRole, maskSalesOrderDetailForRole } from './middleware/mask';
import { parseJson, parseQuery, requireUuid } from './validation';
import { SalesOrderListQuerySchema } from './dto/query.schemas';
import { CreateSalesOrderSchema } from './dto/request.schemas';

export function createSalesOrderRoutes(services: Services): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  routes.get('/', async (c) => {
    const query = parseQuery(c, SalesOrderListQuerySchema);
    const result = await services.salesOrders.list(query);
    return c.json(maskForRole(result, c.get('actor').role));
  });

  routes.get('/:id', async (c) => {
    const id = requireUuid(c.req.param('id'), '受注');
    const result = await services.salesOrders.getFullDetail(id);
    return c.json(maskSalesOrderDetailForRole(result, c.get('actor').role));
  });

  routes.post('/', authorize('sales', 'admin'), async (c) => {
    const body = await parseJson(c, CreateSalesOrderSchema);
    const order = await services.salesOrders.createOrder(body, c.get('actor'));
    return c.json(maskForRole(order, c.get('actor').role), 201);
  });

  routes.patch('/:id/cancel', authorize('sales', 'admin'), async (c) => {
    const id = requireUuid(c.req.param('id'), '受注');
    const order = await services.salesOrders.cancelOrder(id, c.get('actor'));
    return c.json(maskForRole(order, c.get('actor').role));
  });

  return routes;
}
