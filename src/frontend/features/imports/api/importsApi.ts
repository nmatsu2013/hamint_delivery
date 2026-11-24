import { api } from '../../../lib/apiClient';
import type { ImportApplication, ListResponse } from '../../../types/api';

export function getImportApplications(params: {
  status?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.limit) query.set('limit', String(params.limit));
  if (params.offset) query.set('offset', String(params.offset));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return api.get<ListResponse<ImportApplication>>(`/import-applications${suffix}`);
}

export function createImportApplication(payload: {
  purchaseOrderId: string;
  applicationType?: string;
  appliedDate?: string;
  note?: string;
  customsBroker?: string;
}) {
  return api.post<ImportApplication>('/import-applications', payload);
}

export function updateImportApplicationStatus(
  id: string,
  payload: {
    status: string;
    confirmedDate?: string;
    note?: string;
    customsBroker?: string;
    importPermitDate?: string;
    declarationNo?: string;
    taxableValue?: number;
    dutyTotal?: number;
    importConsumptionTax?: number;
    customsFee?: number;
    otherCosts?: number;
  },
) {
  return api.patch<ImportApplication>(`/import-applications/${id}/status`, payload);
}
