import { Hono } from 'hono';
import type { AppEnv } from './app-env.js';
import type { Services } from '../service/services.js';
import { parseJson, parseQuery, requireUuid } from './validation.js';
import { ShipmentListQuerySchema } from './dto/query.schemas.js';
import {
  CreateDomesticShipmentSchema,
  CreateInternationalShipmentSchema,
  MarkDeliveredSchema,
} from './dto/request.schemas.js';

export function createShipmentRoutes(services: Services): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  routes.get('/', async (c) => {
    const query = parseQuery(c, ShipmentListQuerySchema);
    const result = await services.shipments.list(query);
    return c.json(result);
  });

  routes.get('/:id', async (c) => {
    const id = requireUuid(c.req.param('id'), '配送');
    const result = await services.shipments.getDetail(id);
    return c.json(result);
  });

  routes.post('/international', async (c) => {
    const body = await parseJson(c, CreateInternationalShipmentSchema);
    const result = await services.shipments.registerInternationalDeparture(
      body,
      c.get('actor'),
    );
    return c.json(result, 201);
  });

  routes.post('/domestic', async (c) => {
    const body = await parseJson(c, CreateDomesticShipmentSchema);
    const result = await services.shipments.shipDomesticOrder(body, c.get('actor'));
    return c.json(result, 201);
  });

  routes.patch('/:id/delivered', async (c) => {
    const id = requireUuid(c.req.param('id'), '配送');
    const body = await parseJson(c, MarkDeliveredSchema);
    const result = await services.shipments.markDelivered(id, body.deliveredDate, c.get('actor'));
    return c.json(result);
  });

  return routes;
}
