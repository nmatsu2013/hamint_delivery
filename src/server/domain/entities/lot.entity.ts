import type { LotMovementType, LotStatus } from './status';

export interface LotEntity {
  id: string;
  productId: string;
  productCode?: string;
  productName?: string;
  lotNo: string;
  expiryDate: string;
  manufacturedDate: string | null;
  purchaseOrderLineId: string | null;
  receivedQty: number;
  onHandQty: number;
  status: LotStatus;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface LotMovementEntity {
  id?: string;
  lotId: string;
  movementType: LotMovementType;
  /** create.sql の CHECK (quantity > 0) に合わせ、常に正数で保存し種別で増減を判定する。 */
  quantity: number;
  sourceType: string;
  sourceId: string;
  customerId?: string | null;
  shipToId?: string | null;
  createdBy?: string | null;
  createdAt?: string;
}

export interface TraceabilityRowEntity {
  lotNo: string;
  productName: string;
  customerName: string;
  shipToName: string;
  address: string;
  shippedDate: string;
  quantity: number;
  trackingNo: string;
  carrier: string;
}
