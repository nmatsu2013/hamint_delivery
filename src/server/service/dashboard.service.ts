import type { IUnitOfWork } from '../domain/repositories/unit-of-work.interface.js';
import { todayInTokyo } from '../config/date.js';

export interface DashboardKpis {
  todayOrdersCount: number;
  pendingOrdersCount: number;
  inTransitOrdersCount: number;
  unpaidInvoicesCount: number;
  currentMonthOrdersCount: number;
  totalOrdersCount: number;
  statusCounts: Record<string, number>;
  businessDate: string;
}

export class DashboardService {
  constructor(private readonly uow: IUnitOfWork) {}

  async getKpis(now = new Date()): Promise<DashboardKpis> {
    const salesOrders = this.uow.repos.salesOrders;
    const today = todayInTokyo(now);
    const month = today.slice(0, 7);
    const [todayOrdersCount, statusCounts, currentMonthOrdersCount, unpaidInvoicesCount] =
      await Promise.all([
        salesOrders.countByOrderDate(today),
        salesOrders.countByStatuses(),
        salesOrders.countByOrderMonth(month),
        this.uow.repos.invoices.countUnpaid(),
      ]);
    return {
      todayOrdersCount,
      pendingOrdersCount: statusCounts['受付'] ?? 0,
      inTransitOrdersCount: statusCounts['輸入・輸送中'] ?? 0,
      unpaidInvoicesCount,
      currentMonthOrdersCount,
      totalOrdersCount: Object.values(statusCounts).reduce((total, count) => total + count, 0),
      statusCounts,
      businessDate: today,
    };
  }
}
