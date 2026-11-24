import { z } from 'zod';

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD形式で入力してください');

export const CreateSalesOrderSchema = z.object({
  customerId: z.string().uuid(),
  shipToId: z.string().uuid(),
  requestedDate: dateString.optional(),
  note: z.string().optional(),
  lines: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().positive({ message: '数量は1以上の整数である必要があります' }),
      }),
    )
    .min(1, { message: '明細を1件以上入力してください' }),
});

export const CreatePurchaseOrdersFromSoSchema = z.object({
  salesOrderLineIds: z.array(z.string().uuid()).min(1, '受注明細を1件以上指定してください'),
  promisedDate: dateString.optional(),
  note: z.string().optional(),
});

export const CreateInternationalShipmentSchema = z.object({
  purchaseOrderId: z.string().uuid(),
  carrier: z.string().min(1, '配送業者は必須です'),
  blAwbNo: z.string().min(1, 'AWB/BL番号は必須です'),
  shippedDate: dateString,
  transportMode: z.string().optional(),
  etd: dateString.optional(),
  eta: dateString.optional(),
});

export const CreateDomesticShipmentSchema = z.object({
  salesOrderId: z.string().uuid(),
  carrier: z.string().min(1, '配送業者は必須です'),
  trackingNo: z.string().min(1, '追跡番号は必須です'),
  shippedDate: dateString,
  fifoOverrideReason: z.string().optional(),
  lines: z
    .array(
      z.object({
        salesOrderLineId: z.string().uuid(),
        lotId: z.string().uuid(),
        quantity: z.number().int().positive({ message: '出荷数量は1以上です' }),
      }),
    )
    .min(1, '出荷明細を1件以上指定してください'),
});

export const MarkDeliveredSchema = z.object({
  deliveredDate: dateString,
});

export const InspectAndReceiveSchema = z.object({
  poLineId: z.string().uuid(),
  receivedDate: dateString,
  goodQty: z.number().int().min(0),
  defectQty: z.number().int().min(0),
  damagedQty: z.number().int().min(0),
  lotNo: z.string().optional(),
  expiryDate: dateString.optional(),
  manufacturedDate: dateString.optional(),
  claimStatus: z.string().optional(),
  claimNote: z.string().optional(),
});

export const CreateInvoiceSchema = z.object({
  salesOrderId: z.string().uuid(),
  invoiceDate: dateString.optional(),
  dueDate: dateString.optional(),
});

export const RecordPaymentSchema = z.object({
  paidAmount: z.number().positive({ message: '入金額は0より大きい必要があります' }),
  paidDate: dateString,
  method: z.string().optional(),
  fee: z.number().min(0).optional(),
});

export const CreateImportApplicationSchema = z.object({
  purchaseOrderId: z.string().uuid(),
  applicationType: z.string().optional(),
  appliedDate: dateString.optional(),
  assigneeId: z.string().uuid().optional(),
  note: z.string().optional(),
  customsBroker: z.string().optional(),
  documents: z
    .array(
      z.object({
        documentName: z.string().min(1),
        filePath: z.string().optional(),
        submittedDate: dateString.optional(),
      }),
    )
    .optional(),
});

export const UpdateImportApplicationStatusSchema = z.object({
  status: z.string().min(1),
  confirmedDate: dateString.optional(),
  note: z.string().optional(),
  customsBroker: z.string().optional(),
  importPermitDate: dateString.optional(),
  declarationNo: z.string().optional(),
  taxableValue: z.number().min(0).optional(),
  dutyTotal: z.number().min(0).optional(),
  importConsumptionTax: z.number().min(0).optional(),
  customsFee: z.number().min(0).optional(),
  otherCosts: z.number().min(0).optional(),
});

export type CreateSalesOrderDto = z.infer<typeof CreateSalesOrderSchema>;
export type CreatePurchaseOrdersFromSoDto = z.infer<typeof CreatePurchaseOrdersFromSoSchema>;
export type CreateInternationalShipmentDto = z.infer<typeof CreateInternationalShipmentSchema>;
export type CreateDomesticShipmentDto = z.infer<typeof CreateDomesticShipmentSchema>;
export type MarkDeliveredDto = z.infer<typeof MarkDeliveredSchema>;
export type InspectAndReceiveDto = z.infer<typeof InspectAndReceiveSchema>;
export type CreateInvoiceDto = z.infer<typeof CreateInvoiceSchema>;
export type RecordPaymentDto = z.infer<typeof RecordPaymentSchema>;
export type CreateImportApplicationDto = z.infer<typeof CreateImportApplicationSchema>;
export type UpdateImportApplicationStatusDto = z.infer<typeof UpdateImportApplicationStatusSchema>;
