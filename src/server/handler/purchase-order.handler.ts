import { Hono } from 'hono';
import type { AppEnv } from './app-env.js';
import type { Services } from '../service/services.js';
import { parseJson, parseQuery, requireUuid } from './validation.js';
import { PurchaseOrderListQuerySchema } from './dto/query.schemas.js';
import {
  CreatePurchaseOrdersFromSoSchema,
  InspectAndReceiveSchema,
} from './dto/request.schemas.js';
import { ValidationError } from '../domain/errors/domain.error.js';

export function createPurchaseOrderRoutes(services: Services): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  routes.get('/', async (c) => {
    const query = parseQuery(c, PurchaseOrderListQuerySchema);
    const result = await services.purchaseOrders.list(query);
    return c.json(result);
  });

  routes.get('/:id', async (c) => {
    const id = requireUuid(c.req.param('id'), '発注');
    const result = await services.purchaseOrders.getDetail(id);
    return c.json(result);
  });

  routes.post('/create-from-so', async (c) => {
    const body = await parseJson(c, CreatePurchaseOrdersFromSoSchema);
    const created = await services.purchaseOrders.createAndConfirmPo(body, c.get('actor'));
    return c.json({ items: created }, 201);
  });

  routes.post('/:id/inspect', async (c) => {
    const purchaseOrderId = requireUuid(c.req.param('id'), '発注');
    const body = await parseJson(c, InspectAndReceiveSchema);
    const po = await services.purchaseOrders.getDetail(purchaseOrderId);
    if (!po.lines.some((line) => line.id === body.poLineId)) {
      throw new ValidationError('指定した発注明細はこの発注に属していません');
    }
    const result = await services.warehouse.inspectAndReceive(body, c.get('actor'));
    return c.json(result);
  });

  return routes;
}
