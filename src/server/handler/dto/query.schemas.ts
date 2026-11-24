import { z } from 'zod';

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD形式で入力してください');

export const PaginationSchema = z.object({
  limit: z.coerce.number().int().positive().max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const SalesOrderListQuerySchema = PaginationSchema.extend({
  customer: z.string().optional(),
  status: z.string().optional(),
  orderDateFrom: dateString.optional(),
  orderDateTo: dateString.optional(),
  purchaseOrderDate: dateString.optional(),
  arrivalDate: dateString.optional(),
  receivedDate: dateString.optional(),
  search: z.string().optional(),
});

export const PurchaseOrderListQuerySchema = PaginationSchema.extend({
  status: z.string().optional(),
});

export const ShipmentListQuerySchema = PaginationSchema.extend({
  direction: z.string().optional(),
});

export const InvoiceListQuerySchema = PaginationSchema.extend({
  status: z.string().optional(),
});

export const ImportApplicationListQuerySchema = PaginationSchema.extend({
  status: z.string().optional(),
});

export const AvailableLotsQuerySchema = z.object({
  productId: z.string().uuid().optional(),
});

export const TraceQuerySchema = z.object({
  lotNo: z.string().min(1, 'ロット番号を指定してください'),
});

export const PriceResolveQuerySchema = z.object({
  customerId: z.string().uuid(),
  productId: z.string().uuid(),
  date: dateString.optional(),
});

export const AuditLogQuerySchema = PaginationSchema.extend({
  tableName: z.string().optional(),
  recordId: z.string().uuid().optional(),
});

export type SalesOrderListQueryDto = z.infer<typeof SalesOrderListQuerySchema>;
export type PurchaseOrderListQueryDto = z.infer<typeof PurchaseOrderListQuerySchema>;
export type ShipmentListQueryDto = z.infer<typeof ShipmentListQuerySchema>;
export type InvoiceListQueryDto = z.infer<typeof InvoiceListQuerySchema>;
export type ImportApplicationListQueryDto = z.infer<typeof ImportApplicationListQuerySchema>;
export type PriceResolveQueryDto = z.infer<typeof PriceResolveQuerySchema>;
export type AuditLogQueryDto = z.infer<typeof AuditLogQuerySchema>;
