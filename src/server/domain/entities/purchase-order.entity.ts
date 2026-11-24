import type { PurchaseOrderStatus } from './status.js';

export interface PurchaseOrderLineEntity {
  id: string;
  purchaseOrderId: string;
  productId: string;
  productCode?: string;
  productName?: string;
  modelNo?: string;
  quantity: number;
  unitCost: number;
  currency: string;
  salesOrderLineId: string | null;
  appliedHsCode: string | null;
  dutyRate: number | null;
  dutyAmount: number | null;
  dutyCurrency: string;
  receivedDate: string | null;
  inspectorId: string | null;
  goodQty: number | null;
  defectQty: number | null;
  damagedQty: number | null;
  claimStatus: string | null;
  claimNote: string | null;
  isActive: boolean;
}

export interface PurchaseOrderEntity {
  id: string;
  poNo: string;
  supplierId: string;
  supplierName?: string;
  orderedDate: string;
  promisedDate: string | null;
  currency: string;
  totalAmount: number;
  status: PurchaseOrderStatus;
  note: string | null;
  isActive: boolean;
  lines: PurchaseOrderLineEntity[];
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderSummaryEntity {
  id: string;
  poNo: string;
  supplierName: string;
  orderedDate: string;
  promisedDate: string | null;
  currency: string;
  totalAmount: number;
  status: PurchaseOrderStatus;
  lineCount: number;
  totalQuantity: number;
}

export interface CreatePurchaseOrderInput {
  salesOrderLineIds: string[];
  promisedDate?: string;
  note?: string;
}

export interface InspectAndReceiveInput {
  poLineId: string;
  receivedDate: string;
  goodQty: number;
  defectQty: number;
  damagedQty: number;
  lotNo?: string;
  expiryDate?: string;
  manufacturedDate?: string;
  claimStatus?: string;
  claimNote?: string;
}

export interface InspectAndReceiveResult {
  purchaseOrderId: string;
  purchaseOrderLineId: string;
  productId: string;
  orderLineStatus: string;
  lot: import('./lot.entity.js').LotEntity | null;
}
