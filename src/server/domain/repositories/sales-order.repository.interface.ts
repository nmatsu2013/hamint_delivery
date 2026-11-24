import type {
  SalesOrderEntity,
  SalesOrderLineEntity,
  SalesOrderSummaryEntity,
} from '../entities/sales-order.entity';

export interface SalesOrderListParams {
  status?: string;
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
}
