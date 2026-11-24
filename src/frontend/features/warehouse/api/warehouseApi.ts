import { api } from '../../../lib/apiClient';
import type { Lot } from '../../../types/api';

export function getAvailableLots(productId?: string) {
  const suffix = productId ? `?productId=${encodeURIComponent(productId)}` : '';
  return api.get<{ items: Lot[] }>(`/lots/available${suffix}`);
}
