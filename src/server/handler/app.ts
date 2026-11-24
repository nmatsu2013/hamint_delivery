import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '../config/env.js';
import type { Services } from '../service/services.js';
import type { AppEnv } from './app-env.js';
import { createAuthMiddleware } from './middleware/auth.middleware.js';
import { handleError } from './middleware/error-handler.js';
import { createAuthRoutes, createLoginRoute } from './auth.handler.js';
import { createSalesOrderRoutes } from './sales-order.handler.js';
import { createPurchaseOrderRoutes } from './purchase-order.handler.js';
import { createShipmentRoutes } from './shipment.handler.js';
import { createLotRoutes } from './lot.handler.js';
import { createInvoiceRoutes } from './invoice.handler.js';
import { createImportApplicationRoutes } from './import-application.handler.js';
import { createDashboardRoutes } from './dashboard.handler.js';
import { createMasterDataRoutes } from './master-data.handler.js';
import { createAuditLogRoutes } from './audit-log.handler.js';

export function createApp(services: Services, env: Env): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.onError(handleError);

  app.get('/api/health', (c) =>
    c.json({ status: 'ok', environment: env.NODE_ENV, timestamp: new Date().toISOString() }),
  );
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
  app.route('/api/auth', createLoginRoute(env));
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
