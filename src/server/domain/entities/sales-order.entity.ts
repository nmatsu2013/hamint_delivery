import type { SalesOrderLineStatus, SalesOrderStatus } from './status';

export type PaymentStatusLabel = '未請求' | '未入金（請求済）' | '入金済';

export interface SalesOrderLineEntity {
  id: string;
  salesOrderId: string;
  productId: string;
  productCode?: string;
  productName?: string;
  modelNo?: string;
  specNote?: string | null;
  supplierId?: string;
  quantity: number;
  unitPrice: number;
  currency: string;
  lineStatus: SalesOrderLineStatus;
  shippedQuantity: number;
  isActive: boolean;
}

export interface SalesOrderEntity {
  id: string;
  orderNo: string;
  orderDate: string;
  customerId: string;
  customerName?: string;
  shipToId: string;
  shipToName?: string;
  requestedDate: string | null;
  status: SalesOrderStatus;
  totalAmount: number;
  currency: string;
  note: string | null;
  isActive: boolean;
  lines: SalesOrderLineEntity[];
  paymentStatus?: PaymentStatusLabel;
  createdAt: string;
  updatedAt: string;
}

export interface SalesOrderSummaryEntity {
  id: string;
  orderNo: string;
  orderDate: string;
  customerId: string;
  customerName: string;
  shipToId: string;
  shipToName: string;
  requestedDate: string | null;
  status: SalesOrderStatus;
  totalAmount: number;
  currency: string;
  quantity: number;
  mainProductName: string;
  lineCount: number;
  paymentStatus: PaymentStatusLabel;
}

export interface CreateSalesOrderLineInput {
  productId: string;
  quantity: number;
}

export interface CreateSalesOrderInput {
  customerId: string;
  shipToId: string;
  requestedDate?: string;
  note?: string;
  lines: CreateSalesOrderLineInput[];
}

export function calculateTotalAmount(
  lines: ReadonlyArray<{ quantity: number; unitPrice: number }>,
): number {
  return lines.reduce((total, line) => total + line.quantity * line.unitPrice, 0);
}
