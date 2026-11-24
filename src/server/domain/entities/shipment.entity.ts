import type { ShipmentDirection, ShipmentStatus } from './status';

export interface ShipmentLineEntity {
  id: string;
  shipmentId: string;
  salesOrderLineId: string | null;
  purchaseOrderLineId: string | null;
  lotId: string | null;
  quantity: number;
  lotNo?: string;
  productName?: string;
  isActive: boolean;
}

export interface ShipmentEntity {
  id: string;
  shipmentNo: string;
  direction: ShipmentDirection;
  salesOrderId: string | null;
  shipToId: string | null;
  purchaseOrderId: string | null;
  shippedDate: string | null;
  carrier: string | null;
  trackingNo: string | null;
  deliveredDate: string | null;
  status: ShipmentStatus;
  transportMode: string | null;
  blAwbNo: string | null;
  etd: string | null;
  eta: string | null;
  isActive: boolean;
  lines: ShipmentLineEntity[];
  createdAt: string;
  updatedAt: string;
}

export interface ShipmentSummaryEntity {
  id: string;
  shipmentNo: string;
  direction: ShipmentDirection;
  directionLabel: string;
  status: ShipmentStatus;
  shippedDate: string | null;
  deliveredDate: string | null;
  carrier: string | null;
  trackingNo: string | null;
  orderNo?: string;
  poNo?: string;
  totalQuantity: number;
}

export interface CreateInternationalShipmentInput {
  purchaseOrderId: string;
  carrier: string;
  blAwbNo: string;
  shippedDate: string;
  transportMode?: string;
  etd?: string;
  eta?: string;
}

export interface CreateDomesticShipmentLineInput {
  salesOrderLineId: string;
  lotId: string;
  quantity: number;
}

export interface CreateDomesticShipmentInput {
  salesOrderId: string;
  carrier: string;
  trackingNo: string;
  shippedDate: string;
  fifoOverrideReason?: string;
  lines: CreateDomesticShipmentLineInput[];
}

export interface DomesticShipmentResult {
  shipment: ShipmentEntity;
  alreadyProcessed: boolean;
}
