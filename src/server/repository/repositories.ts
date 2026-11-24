import type { RepositoryContext } from '../domain/repositories/unit-of-work.interface';
import type { Queryable } from './database';
import { PgAuditLogRepository } from './pg-audit-log.repository';
import { PgCustomerRepository } from './pg-customer.repository';
import { PgImportApplicationRepository } from './pg-import-application.repository';
import { PgInvoiceRepository } from './pg-invoice.repository';
import { PgLotRepository } from './pg-lot.repository';
import { PgPriceRepository } from './pg-price.repository';
import { PgProductRepository } from './pg-product.repository';
import { PgPurchaseOrderRepository } from './pg-purchase-order.repository';
import { PgSalesOrderRepository } from './pg-sales-order.repository';
import { PgShipmentRepository } from './pg-shipment.repository';

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
  };
}
