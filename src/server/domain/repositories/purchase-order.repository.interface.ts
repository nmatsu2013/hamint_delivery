import type {
  PurchaseOrderEntity,
  PurchaseOrderLineEntity,
  PurchaseOrderSummaryEntity,
} from '../entities/purchase-order.entity.js';

export interface PurchaseOrderListParams {
  status?: string;
  limit: number;
  offset: number;
}

export interface ReceiveUpdateData {
  receivedDate: string;
  goodQty: number;
  defectQty: number;
  damagedQty: number;
  inspectorId: string;
  claimStatus?: string;
  claimNote?: string;
}

export interface IPurchaseOrderRepository {
  findById(id: string): Promise<PurchaseOrderEntity | null>;
  findByPoNo(poNo: string): Promise<PurchaseOrderEntity | null>;
  findByOrderLineId(salesOrderLineId: string): Promise<PurchaseOrderEntity | null>;
  findLineById(purchaseOrderLineId: string): Promise<PurchaseOrderLineEntity | null>;
  findLinesByOrderId(purchaseOrderId: string): Promise<PurchaseOrderLineEntity[]>;
  generatePoNo(date: Date): Promise<string>;
  save(po: PurchaseOrderEntity): Promise<void>;
  updateStatus(id: string, status: string, actorId?: string): Promise<void>;
  updateReceived(orderLineId: string, data: ReceiveUpdateData): Promise<void>;
  list(params: PurchaseOrderListParams): Promise<{ items: PurchaseOrderSummaryEntity[]; total: number }>;
}
