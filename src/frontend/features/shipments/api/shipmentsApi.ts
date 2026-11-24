import { api } from '../../../lib/apiClient';
import type {
  CreateDomesticShipmentPayload,
  CreateInternationalShipmentPayload,
  ListResponse,
  Shipment,
  ShipmentSummary,
} from '../../../types/api';

export function getShipments(params: { direction?: string; limit?: number; offset?: number } = {}) {
  const query = new URLSearchParams();
  if (params.direction) query.set('direction', params.direction);
  if (params.limit) query.set('limit', String(params.limit));
  if (params.offset) query.set('offset', String(params.offset));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return api.get<ListResponse<ShipmentSummary>>(`/shipments${suffix}`);
}

export function createInternationalShipment(payload: CreateInternationalShipmentPayload) {
  return api.post<Shipment>('/shipments/international', payload);
}

export function createDomesticShipment(payload: CreateDomesticShipmentPayload) {
  return api.post<{ shipment: Shipment; alreadyProcessed: boolean }>(
    '/shipments/domestic',
    payload,
  );
}

export function markShipmentDelivered(id: string, deliveredDate: string) {
  return api.patch<Shipment>(`/shipments/${id}/delivered`, { deliveredDate });
}
