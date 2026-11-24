import { api } from '../../../lib/apiClient';
import type {
  ListResponse,
  PurchaseOrder,
  PurchaseOrderSummary,
} from '../../../types/api';

export interface PurchaseOrderQuery {
  status?: string;
  limit?: number;
  offset?: number;
}

export function getPurchaseOrders(query: PurchaseOrderQuery = {}) {
  const params = new URLSearchParams();
  if (query.status) params.set('status', query.status);
  if (query.limit) params.set('limit', String(query.limit));
  if (query.offset) params.set('offset', String(query.offset));
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return api.get<ListResponse<PurchaseOrderSummary>>(`/purchase-orders${suffix}`);
}

export function getPurchaseOrder(id: string) {
  return api.get<PurchaseOrder>(`/purchase-orders/${id}`);
}

export function createPurchaseOrdersFromSo(payload: {
  salesOrderLineIds: string[];
  promisedDate?: string;
  note?: string;
}) {
  return api.post<{ items: PurchaseOrder[] }>('/purchase-orders/create-from-so', payload);
}

export function inspectPurchaseOrderLine(
  purchaseOrderId: string,
  payload: {
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
  },
) {
  return api.post<{ lot: unknown; orderLineStatus: string }>(
    `/purchase-orders/${purchaseOrderId}/inspect`,
    payload,
  );
}
