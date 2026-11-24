import type { IUnitOfWork } from '../domain/repositories/unit-of-work.interface';
import { todayInTokyo } from '../config/date';

export interface DashboardKpis {
  todayOrdersCount: number;
  pendingOrdersCount: number;
  inTransitOrdersCount: number;
  unpaidInvoicesCount: number;
}

export class DashboardService {
  constructor(private readonly uow: IUnitOfWork) {}

  async getKpis(now = new Date()): Promise<DashboardKpis> {
    const salesOrders = this.uow.repos.salesOrders;
    const [todayOrdersCount, pendingOrdersCount, inTransitOrdersCount, unpaidInvoicesCount] =
      await Promise.all([
        salesOrders.countByOrderDate(todayInTokyo(now)),
        salesOrders.countByStatus('受付'),
        salesOrders.countByStatus('輸入・輸送中'),
        this.uow.repos.invoices.countUnpaid(),
      ]);
    return {
      todayOrdersCount,
      pendingOrdersCount,
      inTransitOrdersCount,
      unpaidInvoicesCount,
    };
  }
}
