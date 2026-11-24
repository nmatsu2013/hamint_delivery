import { describe, expect, it } from 'vitest';
import {
  maskForRole,
  maskPurchaseOrderForRole,
  maskSalesOrderDetailForRole,
} from '../../src/server/handler/middleware/mask';

const payload = {
  orderNo: 'so1',
  totalAmount: 1000,
  purchaseOrders: [
    {
      poNo: 'po1',
      totalAmount: 5000,
      lines: [{ productName: 'P1', unitCost: 100, dutyAmount: 50 }],
    },
  ],
};

describe('フィールドマスキング', () => {
  it('営業には仕入単価・関税を返さない', () => {
    const masked = maskForRole(payload, 'sales') as typeof payload;
    expect(masked.purchaseOrders[0]?.lines[0]).toEqual({ productName: 'P1' });
  });

  it('購買・経理・管理者は原価を閲覧できる', () => {
    const masked = maskForRole(payload, 'purchasing') as typeof payload;
    expect(masked.purchaseOrders[0]?.lines[0]?.unitCost).toBe(100);
  });

  it('発注の合計金額（仕入原価）は営業・倉庫に返さない', () => {
    const salesMasked = maskPurchaseOrderForRole(payload.purchaseOrders[0], 'sales') as {
      totalAmount?: number;
    };
    const warehouseMasked = maskPurchaseOrderForRole(payload.purchaseOrders[0], 'warehouse') as {
      totalAmount?: number;
    };
    const purchasing = maskPurchaseOrderForRole(payload.purchaseOrders[0], 'purchasing') as {
      totalAmount?: number;
    };
    expect(salesMasked.totalAmount).toBeUndefined();
    expect(warehouseMasked.totalAmount).toBeUndefined();
    expect(purchasing.totalAmount).toBe(5000);
  });

  it('受注詳細では受注金額を残し、発注金額のみマスクする', () => {
    const masked = maskSalesOrderDetailForRole(payload, 'sales');
    expect(masked.totalAmount).toBe(1000);
    expect((masked.purchaseOrders[0] as { totalAmount?: number }).totalAmount).toBeUndefined();
  });
});
