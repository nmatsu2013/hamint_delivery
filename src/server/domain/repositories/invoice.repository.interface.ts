import type {
  InvoiceEntity,
  InvoiceLineEntity,
  InvoiceSummaryEntity,
  PaymentEntity,
} from '../entities/invoice.entity';

export interface InvoiceListParams {
  status?: string;
  limit: number;
  offset: number;
}

export interface IInvoiceRepository {
  findById(id: string): Promise<InvoiceEntity | null>;
  findByInvoiceNo(invoiceNo: string): Promise<InvoiceEntity | null>;
  findBySalesOrderId(salesOrderId: string): Promise<InvoiceEntity[]>;
  generateInvoiceNo(date: Date): Promise<string>;
  save(invoice: InvoiceEntity, lines: InvoiceLineEntity[]): Promise<void>;
  updateStatus(id: string, status: string, actorId?: string): Promise<void>;
  savePayment(payment: PaymentEntity): Promise<void>;
  getTotalPaidAmount(invoiceId: string): Promise<number>;
  findOrderIdsByInvoiceId(invoiceId: string): Promise<string[]>;
  list(params: InvoiceListParams): Promise<{ items: InvoiceSummaryEntity[]; total: number }>;
  countUnpaid(): Promise<number>;
  /** 確定済みの請求は物理削除できない（AT-27）。 */
  delete(id: string): Promise<void>;
}
