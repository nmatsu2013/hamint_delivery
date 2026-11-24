import { Hono } from 'hono';
import type { AppEnv } from './app-env.js';
import type { Services } from '../service/services.js';
import { parseJson, parseQuery, requireUuid } from './validation.js';
import { InvoiceListQuerySchema } from './dto/query.schemas.js';
import { CreateInvoiceSchema, RecordPaymentSchema } from './dto/request.schemas.js';

export function createInvoiceRoutes(services: Services): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  routes.get('/', async (c) => {
    const query = parseQuery(c, InvoiceListQuerySchema);
    const result = await services.billing.list(query);
    return c.json(result);
  });

  routes.get('/:id', async (c) => {
    const id = requireUuid(c.req.param('id'), '請求');
    const result = await services.billing.getDetail(id);
    return c.json(result);
  });

  routes.post('/', async (c) => {
    const body = await parseJson(c, CreateInvoiceSchema);
    const result = await services.billing.createInvoice(body, c.get('actor'));
    return c.json(result, 201);
  });

  routes.post('/:id/payments', async (c) => {
    const id = requireUuid(c.req.param('id'), '請求');
    const body = await parseJson(c, RecordPaymentSchema);
    const result = await services.billing.recordPayment(
      { ...body, invoiceId: id },
      c.get('actor'),
    );
    return c.json(result, 201);
  });

  routes.delete('/:id', async (c) => {
    const id = requireUuid(c.req.param('id'), '請求');
    await services.billing.deleteInvoice(id);
    return c.body(null, 204);
  });

  return routes;
}
