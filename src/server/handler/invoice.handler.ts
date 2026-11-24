import { Hono } from 'hono';
import type { AppEnv } from './app-env';
import type { Services } from '../service/services';
import { authorize } from './middleware/authorize.middleware';
import { maskForRole } from './middleware/mask';
import { parseJson, parseQuery, requireUuid } from './validation';
import { InvoiceListQuerySchema } from './dto/query.schemas';
import { CreateInvoiceSchema, RecordPaymentSchema } from './dto/request.schemas';

export function createInvoiceRoutes(services: Services): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  routes.get('/', authorize('accounting', 'admin'), async (c) => {
    const query = parseQuery(c, InvoiceListQuerySchema);
    const result = await services.billing.list(query);
    return c.json(maskForRole(result, c.get('actor').role));
  });

  routes.get('/:id', authorize('accounting', 'admin'), async (c) => {
    const id = requireUuid(c.req.param('id'), '請求');
    const result = await services.billing.getDetail(id);
    return c.json(maskForRole(result, c.get('actor').role));
  });

  routes.post('/', authorize('accounting', 'admin'), async (c) => {
    const body = await parseJson(c, CreateInvoiceSchema);
    const result = await services.billing.createInvoice(body, c.get('actor'));
    return c.json(maskForRole(result, c.get('actor').role), 201);
  });

  routes.post('/:id/payments', authorize('accounting', 'admin'), async (c) => {
    const id = requireUuid(c.req.param('id'), '請求');
    const body = await parseJson(c, RecordPaymentSchema);
    const result = await services.billing.recordPayment(
      { ...body, invoiceId: id },
      c.get('actor'),
    );
    return c.json(maskForRole(result, c.get('actor').role), 201);
  });

  routes.delete('/:id', authorize('admin'), async (c) => {
    const id = requireUuid(c.req.param('id'), '請求');
    await services.billing.deleteInvoice(id);
    return c.body(null, 204);
  });

  return routes;
}
