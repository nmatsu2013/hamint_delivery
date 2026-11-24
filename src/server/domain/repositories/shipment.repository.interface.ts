import type {
  ShipmentEntity,
  ShipmentLineEntity,
  ShipmentSummaryEntity,
} from '../entities/shipment.entity';
import type { ShipmentDirection } from '../entities/status';

export interface ShipmentListParams {
  direction?: ShipmentDirection;
  limit: number;
  offset: number;
}

export interface IShipmentRepository {
  save(shipment: ShipmentEntity, lines: ShipmentLineEntity[]): Promise<void>;
  findById(id: string): Promise<ShipmentEntity | null>;
  findByShipmentNo(shipmentNo: string): Promise<ShipmentEntity | null>;
  findExistingByOrderLine(salesOrderLineId: string): Promise<ShipmentEntity[]>;
  findBySalesOrderId(salesOrderId: string): Promise<ShipmentEntity[]>;
  findBySalesOrderAndTracking(salesOrderId: string, trackingNo: string): Promise<ShipmentEntity | null>;
  findByPurchaseOrderId(purchaseOrderId: string): Promise<ShipmentEntity | null>;
  getShippedQuantityByLine(salesOrderLineId: string): Promise<number>;
  generateShipmentNo(direction: ShipmentDirection, date: Date): Promise<string>;
  list(params: ShipmentListParams): Promise<{ items: ShipmentSummaryEntity[]; total: number }>;
  markDelivered(id: string, deliveredDate: string, actorId?: string): Promise<void>;
}
