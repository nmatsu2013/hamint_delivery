import type {
  CustomerAddressEntity,
  CustomerEntity,
} from '../domain/entities/customer.entity';
import type { ProductEntity } from '../domain/entities/product.entity';
import type { IUnitOfWork } from '../domain/repositories/unit-of-work.interface';
import { todayInTokyo } from '../config/date';
import { ensureFound } from './service-support';
import { PriceService } from './price.service';

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
