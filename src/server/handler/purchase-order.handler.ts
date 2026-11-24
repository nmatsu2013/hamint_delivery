import { Hono } from 'hono';
import type { AppEnv } from './app-env';
import type { Services } from '../service/services';
import { authorize } from './middleware/authorize.middleware';
import { maskForRole, maskPurchaseOrderForRole } from './middleware/mask';
import { parseJson, parseQuery, requireUuid } from './validation';
import { PurchaseOrderListQuerySchema } from './dto/query.schemas';
import {
  CreatePurchaseOrdersFromSoSchema,
  InspectAndReceiveSchema,
} from './dto/request.schemas';
import { ValidationError } from '../domain/errors/domain.error';

export function createPurchaseOrderRoutes(services: Services): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  routes.get('/', authorize('purchasing', 'warehouse', 'accounting', 'admin'), async (c) => {
    const query = parseQuery(c, PurchaseOrderListQuerySchema);
    const result = await services.purchaseOrders.list(query);
    return c.json(maskPurchaseOrderForRole(result, c.get('actor').role));
  });

  routes.get(
    '/:id',
    authorize('purchasing', 'warehouse', 'accounting', 'admin'),
    async (c) => {
      const id = requireUuid(c.req.param('id'), '発注');
      const result = await services.purchaseOrders.getDetail(id);
      return c.json(maskPurchaseOrderForRole(result, c.get('actor').role));
    },
  );

  routes.post('/create-from-so', authorize('purchasing', 'admin'), async (c) => {
    const body = await parseJson(c, CreatePurchaseOrdersFromSoSchema);
    const created = await services.purchaseOrders.createAndConfirmPo(body, c.get('actor'));
    return c.json({ items: maskForRole(created, c.get('actor').role) }, 201);
  });

  routes.post('/:id/inspect', authorize('warehouse', 'admin'), async (c) => {
    const purchaseOrderId = requireUuid(c.req.param('id'), '発注');
    const body = await parseJson(c, InspectAndReceiveSchema);
    const po = await services.purchaseOrders.getDetail(purchaseOrderId);
    if (!po.lines.some((line) => line.id === body.poLineId)) {
      throw new ValidationError('指定した発注明細はこの発注に属していません');
    }
    const result = await services.warehouse.inspectAndReceive(body, c.get('actor'));
    return c.json(maskForRole(result, c.get('actor').role));
  });

  return routes;
}
