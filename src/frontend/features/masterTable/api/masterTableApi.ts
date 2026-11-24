import { api } from '../../../lib/apiClient';
import type {
  MasterRowsParams,
  MasterTableRowsResponse,
  MasterTableSummary,
  MasterTableUpdateResponse,
} from '../types/masterTable';

export function getMasterTables() {
  return api.get<{ items: MasterTableSummary[] }>('/master/tables');
}

export function updateMasterRow(
  tableName: string,
  id: string,
  values: Record<string, unknown>,
) {
  return api.patch<MasterTableUpdateResponse>(
    `/master/tables/${encodeURIComponent(tableName)}/rows/${encodeURIComponent(id)}`,
    { values },
  );
}

export function getMasterRows(tableName: string, params: MasterRowsParams) {
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  if (params.isActive !== undefined) query.set('isActive', String(params.isActive));
  if (params.sort) query.set('sort', params.sort);
  if (params.order) query.set('order', params.order);
  query.set('limit', String(params.limit));
  query.set('offset', String(params.offset));
  return api.get<MasterTableRowsResponse>(
    `/master/tables/${encodeURIComponent(tableName)}/rows?${query.toString()}`,
  );
}
