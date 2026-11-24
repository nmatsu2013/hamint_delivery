import { describe, expect, it, vi } from 'vitest';
import { DashboardService } from '../../src/server/service/dashboard.service';
import type { RepositoryContext } from '../../src/server/domain/repositories/unit-of-work.interface';
import type { IUnitOfWork } from '../../src/server/domain/repositories/unit-of-work.interface';

function makeService() {
  const salesOrders = {
    countByOrderDate: vi.fn().mockResolvedValue(2),
    countByStatuses: vi.fn().mockResolvedValue({
      受付: 2,
      発注済: 1,
      '輸入・輸送中': 1,
      出荷済: 1,
      完了: 1,
    }),
    countByOrderMonth: vi.fn().mockResolvedValue(6),
  };
  const invoices = {
    countUnpaid: vi.fn().mockResolvedValue(1),
  };
  const repos = { salesOrders, invoices } as unknown as RepositoryContext;
  const uow: IUnitOfWork = {
    repos,
    run: async (work) => work(repos),
  };
  return { service: new DashboardService(uow), salesOrders, invoices };
}

describe('DashboardService', () => {
  it('件数カード・ステータス別件数・今月件数を返す', async () => {
    process.env.BUSINESS_DATE = '2026-11-24';
    const { service, salesOrders } = makeService();
    const kpis = await service.getKpis();

    expect(salesOrders.countByOrderDate).toHaveBeenCalledWith('2026-11-24');
    expect(salesOrders.countByOrderMonth).toHaveBeenCalledWith('2026-11');
    expect(kpis).toEqual({
      todayOrdersCount: 2,
      pendingOrdersCount: 2,
      inTransitOrdersCount: 1,
      unpaidInvoicesCount: 1,
      currentMonthOrdersCount: 6,
      totalOrdersCount: 6,
      statusCounts: {
        受付: 2,
        発注済: 1,
        '輸入・輸送中': 1,
        出荷済: 1,
        完了: 1,
      },
      businessDate: '2026-11-24',
    });
    delete process.env.BUSINESS_DATE;
  });
});
