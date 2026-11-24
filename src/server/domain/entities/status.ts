/**
 * DB の物理値は日本語ラベル（spec 2.2 の画面表示値）で保持する。
 * API では英語コード / 日本語ラベルのどちらも受け付ける。
 */

export const SALES_ORDER_STATUS = {
  RECEIVED: '受付',
  ORDERED: '発注済',
  IN_TRANSIT: '輸入・輸送中',
  ARRIVED: '入荷済',
  SHIPPED: '出荷済',
  COMPLETED: '完了',
  CANCELLED: '取消',
} as const;
export type SalesOrderStatus = (typeof SALES_ORDER_STATUS)[keyof typeof SALES_ORDER_STATUS];

export const SALES_ORDER_LINE_STATUS = {
  RECEIVED: '受付',
  ORDERED: '発注済',
  IN_TRANSIT: '輸送中',
  ARRIVED: '入荷済',
  SHIPPED: '出荷済',
  COMPLETED: '完了',
  CANCELLED: '取消',
} as const;
export type SalesOrderLineStatus = (typeof SALES_ORDER_LINE_STATUS)[keyof typeof SALES_ORDER_LINE_STATUS];

export const PURCHASE_ORDER_STATUS = {
  DRAFT: '下書き',
  ORDERED: '発注済',
  PARTIALLY_RECEIVED: '一部入荷',
  RECEIVED: '入荷完了',
  CANCELLED: '取消',
} as const;
export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUS)[keyof typeof PURCHASE_ORDER_STATUS];

export const IMPORT_APPLICATION_STATUS = {
  PREPARING: '書類準備中',
  APPLIED: '申請済',
  REVIEWING: '確認中',
  APPROVED: '承認',
  REJECTED: '差戻し',
} as const;
export type ImportApplicationStatus =
  (typeof IMPORT_APPLICATION_STATUS)[keyof typeof IMPORT_APPLICATION_STATUS];

export const SHIPMENT_STATUS = {
  PREPARING: '準備中',
  SHIPPED: '発送済',
  DELIVERED: '納品済',
  UNDELIVERED: '不達',
} as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUS)[keyof typeof SHIPMENT_STATUS];

export const INVOICE_STATUS = {
  UNBILLED: '未請求',
  ISSUED: '請求済',
  PARTIALLY_PAID: '一部入金',
  PAID: '入金済',
} as const;
export type InvoiceStatus = (typeof INVOICE_STATUS)[keyof typeof INVOICE_STATUS];

export const LOT_STATUS = {
  AVAILABLE: '使用可',
  ON_HOLD: '保留',
  RECALLED: '回収',
} as const;
export type LotStatus = (typeof LOT_STATUS)[keyof typeof LOT_STATUS];

export const SHIPMENT_DIRECTION = {
  DOMESTIC: 'domestic',
  INTERNATIONAL: 'international',
} as const;
export type ShipmentDirection = (typeof SHIPMENT_DIRECTION)[keyof typeof SHIPMENT_DIRECTION];

export const SHIPMENT_DIRECTION_LABEL: Record<ShipmentDirection, string> = {
  domestic: '国内配送',
  international: '国際輸送',
};

export const LOT_MOVEMENT_TYPE = {
  RECEIPT: 'receipt',
  SHIPMENT: 'shipment',
  RETURN: 'return',
  DISPOSAL: 'disposal',
  ADJUSTMENT: 'adjustment',
} as const;
export type LotMovementType = (typeof LOT_MOVEMENT_TYPE)[keyof typeof LOT_MOVEMENT_TYPE];

export const LOT_MOVEMENT_TYPE_LABEL: Record<LotMovementType, string> = {
  receipt: '入荷',
  shipment: '出荷',
  return: '返品',
  disposal: '廃棄',
  adjustment: '調整',
};

export const PURCHASE_ORDER_STATUS_OPTIONS = Object.values(PURCHASE_ORDER_STATUS);
export const SALES_ORDER_STATUS_OPTIONS = Object.values(SALES_ORDER_STATUS);
export const IMPORT_APPLICATION_STATUS_OPTIONS = Object.values(IMPORT_APPLICATION_STATUS);
export const INVOICE_STATUS_OPTIONS = Object.values(INVOICE_STATUS);
