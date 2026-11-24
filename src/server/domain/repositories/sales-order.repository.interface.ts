import type {
  SalesOrderEntity,
  SalesOrderLineEntity,
  SalesOrderSummaryEntity,
} from '../entities/sales-order.entity.js';

export interface SalesOrderListParams {
  customer?: string;
  status?: string;
  orderDateFrom?: string;
  orderDateTo?: string;
  purchaseOrderDate?: string;
  arrivalDate?: string;
  receivedDate?: string;
  search?: string;
  limit: number;
  offset: number;
}

export interface ISalesOrderRepository {
  findById(id: string): Promise<SalesOrderEntity | null>;
  findByOrderNo(orderNo: string): Promise<SalesOrderEntity | null>;
  list(params: SalesOrderListParams): Promise<{ items: SalesOrderSummaryEntity[]; total: number }>;
  generateOrderNo(date: Date): Promise<string>;
  save(order: SalesOrderEntity): Promise<void>;
  updateStatus(id: string, status: string, actorId?: string): Promise<void>;
  updateLineStatus(id: string, status: string, actorId?: string): Promise<void>;
  findLinesByIds(ids: string[]): Promise<SalesOrderLineEntity[]>;
  findLinesByOrderId(orderId: string): Promise<SalesOrderLineEntity[]>;
  findOrderIdsByLineIds(lineIds: string[]): Promise<string[]>;
  cancel(id: string, actorId?: string): Promise<void>;
  countByOrderDate(date: string): Promise<number>;
  countByStatus(status: string): Promise<number>;
  /** ステータス別件数（ダッシュボード集計用）。 */
  countByStatuses(): Promise<Record<string, number>>;
  /** 指定月（YYYY-MM）の受注件数。 */
  countByOrderMonth(month: string): Promise<number>;
}
