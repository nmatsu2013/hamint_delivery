import { api } from '../../../lib/apiClient';
import type { Invoice, InvoiceSummary, ListResponse } from '../../../types/api';

export function getInvoices(params: { status?: string; limit?: number; offset?: number } = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.limit) query.set('limit', String(params.limit));
  if (params.offset) query.set('offset', String(params.offset));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return api.get<ListResponse<InvoiceSummary>>(`/invoices${suffix}`);
}

export function getInvoice(id: string) {
  return api.get<Invoice>(`/invoices/${id}`);
}

export function createInvoice(payload: {
  salesOrderId: string;
  invoiceDate?: string;
  dueDate?: string;
}) {
  return api.post<Invoice>('/invoices', payload);
}

export function recordPayment(
  invoiceId: string,
  payload: { paidAmount: number; paidDate: string; method?: string; fee?: number },
) {
  return api.post<{ invoice: Invoice; completedSalesOrderIds: string[] }>(
    `/invoices/${invoiceId}/payments`,
    payload,
  );
}
