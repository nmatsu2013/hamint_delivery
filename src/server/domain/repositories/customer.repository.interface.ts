import type { CustomerAddressEntity, CustomerEntity } from '../entities/customer.entity.js';

export interface ICustomerRepository {
  list(): Promise<CustomerEntity[]>;
  findById(id: string): Promise<CustomerEntity | null>;
  findByCode(customerCode: string): Promise<CustomerEntity | null>;
  listAddresses(customerId: string): Promise<CustomerAddressEntity[]>;
  findAddress(id: string): Promise<CustomerAddressEntity | null>;
}
