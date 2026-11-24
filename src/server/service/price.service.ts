import { BusinessRuleViolationError } from '../domain/errors/domain.error';
import type { RepositoryContext } from '../domain/repositories/unit-of-work.interface';
import type { IUnitOfWork } from '../domain/repositories/unit-of-work.interface';
import { isValidDateString } from '../config/date';

/**
 * UC-01: 顧客別単価 → 標準単価の順で単価を解決する。
 */
export class PriceService {
  constructor(private readonly uow: IUnitOfWork) {}

  async resolveUnitPrice(customerId: string, productId: string, targetDate: string): Promise<number> {
    return this.resolveWith(this.uow.repos, customerId, productId, targetDate);
  }

  async resolveWith(
    repos: RepositoryContext,
    customerId: string,
    productId: string,
    targetDate: string,
  ): Promise<number> {
    if (!isValidDateString(targetDate)) {
      throw new BusinessRuleViolationError(`単価適用日が不正です: ${targetDate}`);
    }
    const customerPrice = await repos.prices.resolveCustomerUnitPrice(
      customerId,
      productId,
      targetDate,
    );
    if (customerPrice !== null) {
      return customerPrice;
    }
    const standardPrice = await repos.prices.resolveStandardUnitPrice(productId, targetDate);
    if (standardPrice !== null) {
      return standardPrice;
    }
    throw new BusinessRuleViolationError('製品の有効な単価が設定されていません');
  }
}
