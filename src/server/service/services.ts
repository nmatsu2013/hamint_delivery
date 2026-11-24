import type { IUnitOfWork } from '../domain/repositories/unit-of-work.interface.js';
import { AuditLogService } from './audit-log.service.js';
import { BillingService } from './billing.service.js';
import { DashboardService } from './dashboard.service.js';
import { ImportApplicationService } from './import-application.service.js';
import { MasterDataService } from './master-data.service.js';
import { PurchaseOrderService } from './purchase-order.service.js';
import { SalesOrderService } from './sales-order.service.js';
import { ShipmentService } from './shipment.service.js';
import { TraceabilityService } from './traceability.service.js';
import { WarehouseService } from './warehouse.service.js';

export interface Services {
  salesOrders: SalesOrderService;
  purchaseOrders: PurchaseOrderService;
  shipments: ShipmentService;
  warehouse: WarehouseService;
  billing: BillingService;
  traceability: TraceabilityService;
  dashboard: DashboardService;
  masterData: MasterDataService;
  importApplications: ImportApplicationService;
  auditLogs: AuditLogService;
}

export function createServices(uow: IUnitOfWork): Services {
  return {
    salesOrders: new SalesOrderService(uow),
    purchaseOrders: new PurchaseOrderService(uow),
    shipments: new ShipmentService(uow),
    warehouse: new WarehouseService(uow),
    billing: new BillingService(uow),
    traceability: new TraceabilityService(uow),
    dashboard: new DashboardService(uow),
    masterData: new MasterDataService(uow),
    importApplications: new ImportApplicationService(uow),
    auditLogs: new AuditLogService(uow),
  };
}
