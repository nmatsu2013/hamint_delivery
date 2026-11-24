import { Hono } from 'hono';
import type { AppEnv } from './app-env.js';
import type { Services } from '../service/services.js';
import { parseJson, parseQuery, requireUuid } from './validation.js';
import { ImportApplicationListQuerySchema } from './dto/query.schemas.js';
import {
  CreateImportApplicationSchema,
  UpdateImportApplicationStatusSchema,
} from './dto/request.schemas.js';

export function createImportApplicationRoutes(services: Services): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  routes.get('/', async (c) => {
    const query = parseQuery(c, ImportApplicationListQuerySchema);
    const result = await services.importApplications.list(query);
    return c.json(result);
  });

  routes.get('/:id', async (c) => {
    const id = requireUuid(c.req.param('id'), '輸入申請');
    const result = await services.importApplications.getDetail(id);
    return c.json(result);
  });

  routes.post('/', async (c) => {
    const body = await parseJson(c, CreateImportApplicationSchema);
    const result = await services.importApplications.create(body, c.get('actor'));
    return c.json(result, 201);
  });

  routes.patch('/:id/status', async (c) => {
    const id = requireUuid(c.req.param('id'), '輸入申請');
    const body = await parseJson(c, UpdateImportApplicationStatusSchema);
    const result = await services.importApplications.updateStatus(id, body, c.get('actor'));
    return c.json(result);
  });

  return routes;
}
