import { api } from '../../../lib/apiClient';
import type { Customer, CustomerAddress, Product } from '../../../types/api';

export function getCustomers() {
  return api.get<{ items: Customer[] }>('/customers');
}

export function getCustomerAddresses(customerId: string) {
  return api.get<{ items: CustomerAddress[] }>(`/customers/${customerId}/addresses`);
}

export function getProducts() {
  return api.get<{ items: Product[] }>('/products');
}

export function resolvePrice(customerId: string, productId: string, date?: string) {
  const query = new URLSearchParams({ customerId, productId });
  if (date) query.set('date', date);
  return api.get<{ unitPrice: number; targetDate: string }>(`/prices/resolve?${query.toString()}`);
}
