import type { IUnitOfWork } from '../domain/repositories/unit-of-work.interface';
import { AuditLogService } from './audit-log.service';
import { BillingService } from './billing.service';
import { DashboardService } from './dashboard.service';
import { ImportApplicationService } from './import-application.service';
import { MasterDataService } from './master-data.service';
import { PurchaseOrderService } from './purchase-order.service';
import { SalesOrderService } from './sales-order.service';
import { ShipmentService } from './shipment.service';
import { TraceabilityService } from './traceability.service';
import { WarehouseService } from './warehouse.service';

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
