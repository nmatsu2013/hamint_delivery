import { Hono } from 'hono';
import type { AppEnv } from './app-env';
import type { Services } from '../service/services';
import { authorize } from './middleware/authorize.middleware';
import { maskForRole } from './middleware/mask';
import { parseJson, parseQuery, requireUuid } from './validation';
import { ImportApplicationListQuerySchema } from './dto/query.schemas';
import {
  CreateImportApplicationSchema,
  UpdateImportApplicationStatusSchema,
} from './dto/request.schemas';

export function createImportApplicationRoutes(services: Services): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  routes.get(
    '/',
    authorize('purchasing', 'warehouse', 'accounting', 'admin'),
    async (c) => {
      const query = parseQuery(c, ImportApplicationListQuerySchema);
      const result = await services.importApplications.list(query);
      return c.json(maskForRole(result, c.get('actor').role));
    },
  );

  routes.get(
    '/:id',
    authorize('purchasing', 'warehouse', 'accounting', 'admin'),
    async (c) => {
      const id = requireUuid(c.req.param('id'), '輸入申請');
      const result = await services.importApplications.getDetail(id);
      return c.json(maskForRole(result, c.get('actor').role));
    },
  );

  routes.post('/', authorize('purchasing', 'admin'), async (c) => {
    const body = await parseJson(c, CreateImportApplicationSchema);
    const result = await services.importApplications.create(body, c.get('actor'));
    return c.json(maskForRole(result, c.get('actor').role), 201);
  });

  routes.patch('/:id/status', authorize('purchasing', 'admin'), async (c) => {
    const id = requireUuid(c.req.param('id'), '輸入申請');
    const body = await parseJson(c, UpdateImportApplicationStatusSchema);
    const result = await services.importApplications.updateStatus(id, body, c.get('actor'));
    return c.json(maskForRole(result, c.get('actor').role));
  });

  return routes;
}
