import type {
  CustomerAddressEntity,
  CustomerEntity,
} from '../domain/entities/customer.entity.js';
import type { ProductEntity } from '../domain/entities/product.entity.js';
import type { IUnitOfWork } from '../domain/repositories/unit-of-work.interface.js';
import { todayInTokyo } from '../config/date.js';
import { ensureFound } from './service-support.js';
import { PriceService } from './price.service.js';

export class MasterDataService {
  private readonly priceService: PriceService;

  constructor(private readonly uow: IUnitOfWork) {
    this.priceService = new PriceService(uow);
  }

  async listCustomers(): Promise<CustomerEntity[]> {
    return this.uow.repos.customers.list();
  }

  async listCustomerAddresses(customerId: string): Promise<CustomerAddressEntity[]> {
    ensureFound(await this.uow.repos.customers.findById(customerId), '顧客', customerId);
    return this.uow.repos.customers.listAddresses(customerId);
  }

  async listProducts(): Promise<ProductEntity[]> {
    return this.uow.repos.products.listActive();
  }

  async resolvePrice(
    customerId: string,
    productId: string,
    targetDate?: string,
  ): Promise<{ unitPrice: number; targetDate: string }> {
    const date = targetDate ?? todayInTokyo();
    const unitPrice = await this.priceService.resolveUnitPrice(customerId, productId, date);
    return { unitPrice, targetDate: date };
  }
}
