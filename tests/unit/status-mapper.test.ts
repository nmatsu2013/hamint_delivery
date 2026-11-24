import { describe, expect, it } from 'vitest';
import {
  deriveSalesOrderStatus,
  normalizeLotMovementType,
  normalizeSalesOrderLineStatus,
  normalizeShipmentDirection,
} from '../../src/server/domain/entities/status-mapper';

describe('status-mapper', () => {
  it('明細の最も遅い状態に親受注を合わせる', () => {
    expect(deriveSalesOrderStatus(['受付', '入荷済'])).toBe('受付');
    expect(deriveSalesOrderStatus(['発注済', '輸送中'])).toBe('発注済');
    expect(deriveSalesOrderStatus(['入荷済', '入荷済'])).toBe('入荷済');
    expect(deriveSalesOrderStatus(['出荷済', '完了'])).toBe('出荷済');
    expect(deriveSalesOrderStatus(['完了', '完了'])).toBe('完了');
  });

  it('輸送中は親では「輸入・輸送中」になる', () => {
    expect(deriveSalesOrderStatus(['輸送中', '入荷済'])).toBe('輸入・輸送中');
  });

  it('取消明細は親状態の判定から除外し、全取消なら取消', () => {
    expect(deriveSalesOrderStatus(['取消', '受付'])).toBe('受付');
    expect(deriveSalesOrderStatus(['取消', '取消'])).toBe('取消');
  });

  it('英語コードと日本語ラベルの両方を受け付ける', () => {
    expect(normalizeSalesOrderLineStatus('in_transit')).toBe('輸送中');
    expect(normalizeSalesOrderLineStatus('輸送中')).toBe('輸送中');
    expect(normalizeShipmentDirection('国際輸送')).toBe('international');
    expect(normalizeShipmentDirection('domestic')).toBe('domestic');
    expect(normalizeLotMovementType('shipment')).toBe('shipment');
    expect(normalizeLotMovementType('入荷')).toBe('receipt');
  });

  it('不正な値はValidationError', () => {
    expect(() => normalizeSalesOrderLineStatus('unknown')).toThrow('受注明細状態の値が不正です');
  });
});
