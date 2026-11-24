import type { Actor } from '../entities/actor.entity';
import type { IAuditLogRepository } from './audit-log.repository.interface';
import type { ICustomerRepository } from './customer.repository.interface';
import type { IImportApplicationRepository } from './import-application.repository.interface';
import type { IInvoiceRepository } from './invoice.repository.interface';
import type { ILotRepository } from './lot.repository.interface';
import type { IPriceRepository } from './price.repository.interface';
import type { IProductRepository } from './product.repository.interface';
import type { IPurchaseOrderRepository } from './purchase-order.repository.interface';
import type { ISalesOrderRepository } from './sales-order.repository.interface';
import type { IShipmentRepository } from './shipment.repository.interface';

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
}

/**
 * トランザクション境界。service はこのインターフェースにのみ依存する。
 * run() のコールバックに渡されるリポジトリは同一トランザクションに束縛される。
 */
export interface IUnitOfWork {
  readonly repos: RepositoryContext;
  run<T>(work: (repos: RepositoryContext) => Promise<T>, actor?: Actor): Promise<T>;
}
