import { api } from '../../../lib/apiClient';
import type { TraceabilityResponse } from '../../../types/api';

export function getTraceability(lotNo: string) {
  return api.get<TraceabilityResponse>(`/lots/trace?lotNo=${encodeURIComponent(lotNo)}`);
}
