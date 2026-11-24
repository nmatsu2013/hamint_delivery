import { Hono } from 'hono';
import type { AppEnv } from './app-env.js';
import type { Services } from '../service/services.js';
import { parseJson, parseQuery, requireUuid } from './validation.js';
import { MasterRowsQuerySchema, MasterRowUpdateSchema } from './dto/master-table.schemas.js';

export function createMasterTableRoutes(services: Services): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  routes.get('/tables', (c) => {
    return c.json({ items: services.masterTables.listTables() });
  });

  routes.get('/tables/:tableName/rows', async (c) => {
    const query = parseQuery(c, MasterRowsQuerySchema);
    const tableName = c.req.param('tableName');
    const result = await services.masterTables.listRows(tableName, {
      ...query,
      isActive: query.isActive === undefined ? undefined : query.isActive === 'true',
    });
    return c.json(result);
  });

  routes.patch('/tables/:tableName/rows/:id', async (c) => {
    const body = await parseJson(c, MasterRowUpdateSchema);
    const id = requireUuid(c.req.param('id'), 'レコード');
    const result = await services.masterTables.updateRow(
      c.req.param('tableName'),
      id,
      body.values,
      c.get('actor'),
    );
    return c.json(result);
  });

  return routes;
}
