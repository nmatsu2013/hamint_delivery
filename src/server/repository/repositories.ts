import type { RepositoryContext } from '../domain/repositories/unit-of-work.interface.js';
import type { Queryable } from './database.js';
import { PgAuditLogRepository } from './pg-audit-log.repository.js';
import { PgCustomerRepository } from './pg-customer.repository.js';
import { PgImportApplicationRepository } from './pg-import-application.repository.js';
import { PgInvoiceRepository } from './pg-invoice.repository.js';
import { PgLotRepository } from './pg-lot.repository.js';
import { PgPriceRepository } from './pg-price.repository.js';
import { PgProductRepository } from './pg-product.repository.js';
import { PgPurchaseOrderRepository } from './pg-purchase-order.repository.js';
import { PgSalesOrderRepository } from './pg-sales-order.repository.js';
import { PgShipmentRepository } from './pg-shipment.repository.js';
import { PgMasterTableRepository } from './pg-master-table.repository.js';

export function createRepositories(db: Queryable): RepositoryContext {
  return {
    salesOrders: new PgSalesOrderRepository(db),
    purchaseOrders: new PgPurchaseOrderRepository(db),
    lots: new PgLotRepository(db),
    shipments: new PgShipmentRepository(db),
    invoices: new PgInvoiceRepository(db),
    importApplications: new PgImportApplicationRepository(db),
    prices: new PgPriceRepository(db),
    customers: new PgCustomerRepository(db),
    products: new PgProductRepository(db),
    auditLogs: new PgAuditLogRepository(db),
    masterTables: new PgMasterTableRepository(db),
  };
}
