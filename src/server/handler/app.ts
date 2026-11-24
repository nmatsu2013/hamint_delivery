import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '../config/env';
import type { Services } from '../service/services';
import type { AppEnv } from './app-env';
import { createAuthMiddleware } from './middleware/auth.middleware';
import { handleError } from './middleware/error-handler';
import { createAuthRoutes, createDevLoginRoute } from './auth.handler';
import { createSalesOrderRoutes } from './sales-order.handler';
import { createPurchaseOrderRoutes } from './purchase-order.handler';
import { createShipmentRoutes } from './shipment.handler';
import { createLotRoutes } from './lot.handler';
import { createInvoiceRoutes } from './invoice.handler';
import { createImportApplicationRoutes } from './import-application.handler';
import { createDashboardRoutes } from './dashboard.handler';
import { createMasterDataRoutes } from './master-data.handler';
import { createAuditLogRoutes } from './audit-log.handler';

export function createApp(services: Services, env: Env): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.onError(handleError);

  app.get('/api/health', (c) =>
    c.json({ status: 'ok', environment: env.NODE_ENV, timestamp: new Date().toISOString() }),
  );
  app.route('/api/auth', createDevLoginRoute(env));

  const origins =
    env.CORS_ORIGIN === '*'
      ? '*'
      : env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean);
  app.use(
    '/api/*',
    cors({
      origin: origins,
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Authorization', 'Content-Type'],
      maxAge: 600,
    }),
  );
  app.use('/api/*', createAuthMiddleware(env));

  // 仕様: GET /api/me
  app.route('/api', createAuthRoutes());
  app.route('/api/dashboard', createDashboardRoutes(services));
  app.route('/api/sales-orders', createSalesOrderRoutes(services));
  app.route('/api/purchase-orders', createPurchaseOrderRoutes(services));
  app.route('/api/shipments', createShipmentRoutes(services));
  app.route('/api/lots', createLotRoutes(services));
  app.route('/api/invoices', createInvoiceRoutes(services));
  app.route('/api/import-applications', createImportApplicationRoutes(services));
  app.route('/api/audit-logs', createAuditLogRoutes(services));
  app.route('/api', createMasterDataRoutes(services));

  app.notFound((c) =>
    c.json({ error: { code: 'NOT_FOUND', message: 'エンドポイントが見つかりません' } }, 404),
  );

  return app;
}
