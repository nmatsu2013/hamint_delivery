import type { Actor } from '../entities/actor.entity.js';
import type { IAuditLogRepository } from './audit-log.repository.interface.js';
import type { ICustomerRepository } from './customer.repository.interface.js';
import type { IImportApplicationRepository } from './import-application.repository.interface.js';
import type { IInvoiceRepository } from './invoice.repository.interface.js';
import type { ILotRepository } from './lot.repository.interface.js';
import type { IPriceRepository } from './price.repository.interface.js';
import type { IProductRepository } from './product.repository.interface.js';
import type { IPurchaseOrderRepository } from './purchase-order.repository.interface.js';
import type { ISalesOrderRepository } from './sales-order.repository.interface.js';
import type { IShipmentRepository } from './shipment.repository.interface.js';
import type { IMasterTableRepository } from './master-table.repository.interface.js';

export interface RepositoryContext {
  salesOrders: ISalesOrderRepository;
  purchaseOrders: IPurchaseOrderRepository;
  lots: ILotRepository;
  shipments: IShipmentRepository;
  invoices: IInvoiceRepository;
  importApplications: IImportApplicationRepository;
  prices: IPriceRepository;
  customers: ICustomerRepository;
  products: IProductRepository;
  auditLogs: IAuditLogRepository;
  masterTables: IMasterTableRepository;
}

/**
 * トランザクション境界。service はこのインターフェースにのみ依存する。
 * run() のコールバックに渡されるリポジトリは同一トランザクションに束縛される。
 */
export interface IUnitOfWork {
  readonly repos: RepositoryContext;
  run<T>(work: (repos: RepositoryContext) => Promise<T>, actor?: Actor): Promise<T>;
}
