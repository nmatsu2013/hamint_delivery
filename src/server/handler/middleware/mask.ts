import type { Role } from '../../domain/entities/actor.entity';

const COST_FIELDS = new Set([
  'unitCost',
  'purchaseUnitCost',
  'supplierPrices',
  'dutyRate',
  'dutyAmount',
  'taxableValue',
  'dutyTotal',
  'importConsumptionTax',
  'customsFee',
  'otherCosts',
]);

/**
 * 営業・倉庫には仕入価格・原価情報を返さない（AT-25）。
 */
export function maskForRole<T>(value: T, role: Role): T {
  if (role !== 'sales' && role !== 'warehouse') {
    return value;
  }
  return maskValue(value) as T;
}

function maskValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => maskValue(item));
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (COST_FIELDS.has(key)) {
        continue;
      }
      result[key] = maskValue(entry);
    }
    return result;
  }
  return value;
}

function stripKeys(value: unknown, keys: Set<string>): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stripKeys(item, keys));
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (keys.has(key)) {
        continue;
      }
      result[key] = stripKeys(entry, keys);
    }
    return result;
  }
  return value;
}

const PURCHASE_COST_FIELDS = new Set(['totalAmount']);

/** 発注の合計金額（=仕入原価）は営業・倉庫に返さない。 */
export function maskPurchaseOrderForRole<T>(value: T, role: Role): T {
  const masked = maskForRole(value, role);
  if (role !== 'sales' && role !== 'warehouse') {
    return masked;
  }
  return stripKeys(masked, PURCHASE_COST_FIELDS) as T;
}

/** 受注詳細に含まれる発注情報の原価をマスキングする。 */
export function maskSalesOrderDetailForRole<T extends { purchaseOrders: unknown[] }>(
  detail: T,
  role: Role,
): T {
  const masked = maskForRole(detail, role);
  if (role !== 'sales' && role !== 'warehouse') {
    return masked;
  }
  return {
    ...masked,
    purchaseOrders: masked.purchaseOrders.map((po) => stripKeys(po, PURCHASE_COST_FIELDS)),
  };
}
