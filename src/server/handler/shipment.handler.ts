import { Hono } from 'hono';
import type { AppEnv } from './app-env';
import type { Services } from '../service/services';
import { authorize } from './middleware/authorize.middleware';
import { maskForRole } from './middleware/mask';
import { parseJson, parseQuery, requireUuid } from './validation';
import { ShipmentListQuerySchema } from './dto/query.schemas';
import {
  CreateDomesticShipmentSchema,
  CreateInternationalShipmentSchema,
  MarkDeliveredSchema,
} from './dto/request.schemas';

export function createShipmentRoutes(services: Services): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  routes.get('/', async (c) => {
    const query = parseQuery(c, ShipmentListQuerySchema);
    const result = await services.shipments.list(query);
    return c.json(maskForRole(result, c.get('actor').role));
  });

  routes.get('/:id', async (c) => {
    const id = requireUuid(c.req.param('id'), '配送');
    const result = await services.shipments.getDetail(id);
    return c.json(maskForRole(result, c.get('actor').role));
  });

  routes.post('/international', authorize('purchasing', 'admin'), async (c) => {
    const body = await parseJson(c, CreateInternationalShipmentSchema);
    const result = await services.shipments.registerInternationalDeparture(
      body,
      c.get('actor'),
    );
    return c.json(maskForRole(result, c.get('actor').role), 201);
  });

  routes.post('/domestic', authorize('warehouse', 'admin'), async (c) => {
    const body = await parseJson(c, CreateDomesticShipmentSchema);
    const result = await services.shipments.shipDomesticOrder(body, c.get('actor'));
    return c.json(maskForRole(result, c.get('actor').role), 201);
  });

  routes.patch('/:id/delivered', authorize('warehouse', 'admin'), async (c) => {
    const id = requireUuid(c.req.param('id'), '配送');
    const body = await parseJson(c, MarkDeliveredSchema);
    const result = await services.shipments.markDelivered(id, body.deliveredDate, c.get('actor'));
    return c.json(maskForRole(result, c.get('actor').role));
  });

  return routes;
}
