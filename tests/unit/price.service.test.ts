import { describe, expect, it, vi } from 'vitest';
import { PriceService } from '../../src/server/service/price.service';
import { BusinessRuleViolationError } from '../../src/server/domain/errors/domain.error';
import type { RepositoryContext } from '../../src/server/domain/repositories/unit-of-work.interface';
import type { IUnitOfWork } from '../../src/server/domain/repositories/unit-of-work.interface';

function makeService(options: {
  customerPrice?: number | null;
  standardPrice?: number | null;
}) {
  const prices = {
    resolveCustomerUnitPrice: vi.fn().mockResolvedValue(options.customerPrice ?? null),
    resolveStandardUnitPrice: vi.fn().mockResolvedValue(options.standardPrice ?? null),
    resolveSupplierCost: vi.fn(),
  };
  const repos = { prices } as unknown as RepositoryContext;
  const uow: IUnitOfWork = {
    repos,
    run: async (work) => work(repos),
  };
  return { service: new PriceService(uow), prices };
}

describe('PriceService (UC-01)', () => {
  it('顧客別単価があれば最優先する', async () => {
    const { service, prices } = makeService({ customerPrice: 440, standardPrice: 450 });
    await expect(service.resolveUnitPrice('c1', 'p1', '2026-11-24')).resolves.toBe(440);
    expect(prices.resolveStandardUnitPrice).not.toHaveBeenCalled();
  });

  it('顧客別単価がなければ標準単価を使う', async () => {
    const { service } = makeService({ customerPrice: null, standardPrice: 450 });
    await expect(service.resolveUnitPrice('c1', 'p1', '2026-11-24')).resolves.toBe(450);
  });

  it('単価がなければBusinessRuleViolationError', async () => {
    const { service } = makeService({});
    await expect(service.resolveUnitPrice('c1', 'p1', '2026-11-24')).rejects.toThrow(
      BusinessRuleViolationError,
    );
  });

  it('適用日が不正ならBusinessRuleViolationError', async () => {
    const { service } = makeService({ standardPrice: 450 });
    await expect(service.resolveUnitPrice('c1', 'p1', '2026/11/24')).rejects.toThrow(
      '単価適用日が不正です',
    );
  });
});
