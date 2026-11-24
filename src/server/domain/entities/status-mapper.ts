import { ValidationError } from '../errors/domain.error';
import type {
  ImportApplicationStatus,
  InvoiceStatus,
  LotMovementType,
  LotStatus,
  PurchaseOrderStatus,
  SalesOrderLineStatus,
  SalesOrderStatus,
  ShipmentDirection,
  ShipmentStatus,
} from './status';
import { SALES_ORDER_LINE_STATUS } from './status';

function normalizeValue<T extends string>(
  value: string,
  aliases: Record<string, T>,
  label: string,
): T {
  const normalized = aliases[value];
  if (!normalized) {
    throw new ValidationError(`${label}の値が不正です: ${value}`, { value });
  }
  return normalized;
}

const SALES_ORDER_ALIASES: Record<string, SalesOrderStatus> = {
  draft: '受付',
  received: '受付',
  ordered: '発注済',
  in_transit: '輸入・輸送中',
  arrived: '入荷済',
  shipped: '出荷済',
  completed: '完了',
  cancelled: '取消',
  受付: '受付',
  発注済: '発注済',
  '輸入・輸送中': '輸入・輸送中',
  入荷済: '入荷済',
  出荷済: '出荷済',
  完了: '完了',
  取消: '取消',
};

const SALES_ORDER_LINE_ALIASES: Record<string, SalesOrderLineStatus> = {
  received: '受付',
  ordered: '発注済',
  in_transit: '輸送中',
  arrived: '入荷済',
  shipped: '出荷済',
  completed: '完了',
  cancelled: '取消',
  受付: '受付',
  発注済: '発注済',
  輸送中: '輸送中',
  入荷済: '入荷済',
  出荷済: '出荷済',
  完了: '完了',
  取消: '取消',
};

const PURCHASE_ORDER_ALIASES: Record<string, PurchaseOrderStatus> = {
  draft: '下書き',
  ordered: '発注済',
  partially_received: '一部入荷',
  received: '入荷完了',
  cancelled: '取消',
  下書き: '下書き',
  発注済: '発注済',
  一部入荷: '一部入荷',
  入荷完了: '入荷完了',
  取消: '取消',
};

const IMPORT_APPLICATION_ALIASES: Record<string, ImportApplicationStatus> = {
  preparing: '書類準備中',
  applied: '申請済',
  reviewing: '確認中',
  approved: '承認',
  rejected: '差戻し',
  書類準備中: '書類準備中',
  申請済: '申請済',
  確認中: '確認中',
  承認: '承認',
  差戻し: '差戻し',
};

const SHIPMENT_ALIASES: Record<string, ShipmentStatus> = {
  preparing: '準備中',
  shipped: '発送済',
  delivered: '納品済',
  undelivered: '不達',
  準備中: '準備中',
  発送済: '発送済',
  納品済: '納品済',
  不達: '不達',
};

const INVOICE_ALIASES: Record<string, InvoiceStatus> = {
  unbilled: '未請求',
  issued: '請求済',
  partially_paid: '一部入金',
  paid: '入金済',
  未請求: '未請求',
  請求済: '請求済',
  一部入金: '一部入金',
  入金済: '入金済',
};

const LOT_ALIASES: Record<string, LotStatus> = {
  available: '使用可',
  on_hold: '保留',
  recalled: '回収',
  使用可: '使用可',
  保留: '保留',
  回収: '回収',
};

const DIRECTION_ALIASES: Record<string, ShipmentDirection> = {
  domestic: 'domestic',
  international: 'international',
  国内配送: 'domestic',
  国際輸送: 'international',
};

const MOVEMENT_ALIASES: Record<string, LotMovementType> = {
  receipt: 'receipt',
  shipment: 'shipment',
  return: 'return',
  disposal: 'disposal',
  adjustment: 'adjustment',
  入荷: 'receipt',
  出荷: 'shipment',
  返品: 'return',
  廃棄: 'disposal',
  調整: 'adjustment',
};

export const normalizeSalesOrderStatus = (value: string): SalesOrderStatus =>
  normalizeValue(value, SALES_ORDER_ALIASES, '受注状態');

export const normalizeSalesOrderLineStatus = (value: string): SalesOrderLineStatus =>
  normalizeValue(value, SALES_ORDER_LINE_ALIASES, '受注明細状態');

export const normalizePurchaseOrderStatus = (value: string): PurchaseOrderStatus =>
  normalizeValue(value, PURCHASE_ORDER_ALIASES, '発注状態');

export const normalizeImportApplicationStatus = (
  value: string,
): ImportApplicationStatus => normalizeValue(value, IMPORT_APPLICATION_ALIASES, '輸入申請状態');

export const normalizeShipmentStatus = (value: string): ShipmentStatus =>
  normalizeValue(value, SHIPMENT_ALIASES, '配送状態');

export const normalizeInvoiceStatus = (value: string): InvoiceStatus =>
  normalizeValue(value, INVOICE_ALIASES, '請求状態');

export const normalizeLotStatus = (value: string): LotStatus =>
  normalizeValue(value, LOT_ALIASES, 'ロット状態');

export const normalizeShipmentDirection = (value: string): ShipmentDirection =>
  normalizeValue(value, DIRECTION_ALIASES, '配送区分');

export const normalizeLotMovementType = (value: string): LotMovementType =>
  normalizeValue(value, MOVEMENT_ALIASES, 'ロット移動種別');

const LINE_PROGRESS: Record<SalesOrderLineStatus, number> = {
  受付: 1,
  発注済: 2,
  輸送中: 3,
  入荷済: 4,
  出荷済: 5,
  完了: 6,
  取消: 99,
};

function safeLineStatus(value: string): SalesOrderLineStatus {
  try {
    return normalizeSalesOrderLineStatus(value);
  } catch {
    return SALES_ORDER_LINE_STATUS.RECEIVED;
  }
}

/**
 * 親受注の状態は「有効な明細のうち最も進んでいないもの」に合わせる（要確認事項 9 の暫定実装）。
 */
export function deriveSalesOrderStatus(lineStatuses: readonly string[]): SalesOrderStatus {
  const active = lineStatuses
    .map(safeLineStatus)
    .filter((status) => status !== SALES_ORDER_LINE_STATUS.CANCELLED);
  if (active.length === 0) {
    return '取消';
  }
  const slowest = active.reduce((prev, current) =>
    LINE_PROGRESS[current] < LINE_PROGRESS[prev] ? current : prev,
  );
  switch (slowest) {
    case '受付':
      return '受付';
    case '発注済':
      return '発注済';
    case '輸送中':
      return '輸入・輸送中';
    case '入荷済':
      return '入荷済';
    case '出荷済':
      return '出荷済';
    case '完了':
      return '完了';
  }
}

/** 明細がすべて同じ状態以上か判定する。 */
export function areAllLinesAtLeast(
  lineStatuses: readonly string[],
  minimum: SalesOrderLineStatus,
): boolean {
  const active = lineStatuses
    .map(safeLineStatus)
    .filter((status) => status !== SALES_ORDER_LINE_STATUS.CANCELLED);
  if (active.length === 0) {
    return false;
  }
  return active.every((status) => LINE_PROGRESS[status] >= LINE_PROGRESS[minimum]);
}
