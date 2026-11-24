import type { InvoiceStatus } from './status';

export interface InvoiceLineEntity {
  id: string;
  invoiceId: string;
  salesOrderLineId: string | null;
  shipmentLineId: string | null;
  amount: number;
  currency: string;
  productName?: string;
  quantity?: number;
  isActive: boolean;
}

export interface PaymentEntity {
  id: string;
  invoiceId: string;
  paidDate: string;
  paidAmount: number;
  currency: string;
  method: string | null;
  fee: number | null;
  isActive: boolean;
}

export interface InvoiceEntity {
  id: string;
  invoiceNo: string;
  customerId: string;
  customerName?: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  isActive: boolean;
  lines: InvoiceLineEntity[];
  payments: PaymentEntity[];
  paidAmount: number;
  unpaidAmount: number;
  salesOrderIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceSummaryEntity {
  id: string;
  invoiceNo: string;
  customerName: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  paidAmount: number;
  unpaidAmount: number;
  orderNos: string[];
}

export interface CreateInvoiceInput {
  salesOrderId: string;
  invoiceDate?: string;
  dueDate?: string;
}

export interface RecordPaymentInput {
  invoiceId: string;
  paidAmount: number;
  paidDate: string;
  method?: string;
  fee?: number;
}

export interface RecordPaymentResult {
  invoice: InvoiceEntity;
  completedSalesOrderIds: string[];
}
