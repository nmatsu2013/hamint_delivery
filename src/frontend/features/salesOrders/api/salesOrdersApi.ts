import { api } from '../../../lib/apiClient';
import type {
  CreateSalesOrderPayload,
  DashboardKpis,
  ListResponse,
  SalesOrder,
  SalesOrderDetail,
  SalesOrderSummary,
} from '../../../types/api';

export interface SalesOrderQuery {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export function getSalesOrders(query: SalesOrderQuery = {}) {
  const params = new URLSearchParams();
  if (query.status) params.set('status', query.status);
  if (query.search) params.set('search', query.search);
  if (query.limit) params.set('limit', String(query.limit));
  if (query.offset) params.set('offset', String(query.offset));
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return api.get<ListResponse<SalesOrderSummary> & { total: number }>(`/sales-orders${suffix}`);
}

export function getDashboardKpis() {
  return api.get<DashboardKpis>('/dashboard/kpis');
}

export function getSalesOrderDetail(id: string) {
  return api.get<SalesOrderDetail>(`/sales-orders/${id}`);
}

export function createSalesOrder(payload: CreateSalesOrderPayload) {
  return api.post<SalesOrder>('/sales-orders', payload);
}

export function cancelSalesOrder(id: string) {
  return api.patch<SalesOrder>(`/sales-orders/${id}/cancel`, {});
}
