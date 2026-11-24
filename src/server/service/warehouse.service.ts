import { randomUUID } from 'node:crypto';
import {
  BusinessRuleViolationError,
  ValidationError,
} from '../domain/errors/domain.error.js';
import type { Actor } from '../domain/entities/actor.entity.js';
import type {
  InspectAndReceiveInput,
  InspectAndReceiveResult,
} from '../domain/entities/purchase-order.entity.js';
import type { LotEntity } from '../domain/entities/lot.entity.js';
import {
  LOT_STATUS,
  PURCHASE_ORDER_STATUS,
  SALES_ORDER_LINE_STATUS,
} from '../domain/entities/status.js';
import type { IUnitOfWork } from '../domain/repositories/unit-of-work.interface.js';
import { isValidDateString, todayInTokyo } from '../config/date.js';
import {
  ensureFound,
  ensureNonNegativeInteger,
  syncSalesOrderStatus,
} from './service-support.js';

export class WarehouseService {
  constructor(private readonly uow: IUnitOfWork) {}

  async listAvailableLots(productId?: string): Promise<LotEntity[]> {
    return this.uow.repos.lots.listAvailable(productId || undefined);
  }

  /** UC-05: 入庫・検品・ロット生成 */
  async inspectAndReceive(
    input: InspectAndReceiveInput,
    actor: Actor,
  ): Promise<InspectAndReceiveResult> {
    if (!isValidDateString(input.receivedDate)) {
      throw new ValidationError('入庫日の形式が不正です');
    }
    ensureNonNegativeInteger(input.goodQty, '良品数');
    ensureNonNegativeInteger(input.defectQty, '不良数');
    ensureNonNegativeInteger(input.damagedQty, '破損数');

    return this.uow.run(async (repos) => {
      const line = ensureFound(
        await repos.purchaseOrders.findLineById(input.poLineId),
        '発注明細',
        input.poLineId,
      );
      if (line.receivedDate) {
        throw new BusinessRuleViolationError('この発注明細は既に検品済みです');
      }
      const totalInspected = input.goodQty + input.defectQty + input.damagedQty;
      if (totalInspected !== line.quantity) {
        throw new ValidationError(
          `良品数・不良数・破損数の合計（${totalInspected}）が発注数量（${line.quantity}）と一致しません`,
        );
      }
      if (input.goodQty > 0) {
        if (!input.lotNo?.trim()) {
          throw new ValidationError('良品数が1以上の場合、ロット番号は必須です');
        }
        if (!input.expiryDate || !isValidDateString(input.expiryDate)) {
          throw new ValidationError('良品数が1以上の場合、使用期限は必須です');
        }
        if (input.expiryDate < todayInTokyo()) {
          throw new BusinessRuleViolationError('使用期限切れのロットは登録できません');
        }
      }
      if (input.manufacturedDate && !isValidDateString(input.manufacturedDate)) {
        throw new ValidationError('製造日の形式が不正です');
      }

      const hasProblem = input.defectQty + input.damagedQty > 0;
      await repos.purchaseOrders.updateReceived(line.id, {
        receivedDate: input.receivedDate,
        goodQty: input.goodQty,
        defectQty: input.defectQty,
        damagedQty: input.damagedQty,
        inspectorId: actor.id,
        claimStatus: input.claimStatus ?? (hasProblem ? 'メーカーへ連絡' : 'なし'),
        claimNote: input.claimNote,
      });

      let lot: LotEntity | null = null;
      if (input.goodQty > 0 && input.lotNo && input.expiryDate) {
        const existing = await repos.lots.findByProductAndLotNo(line.productId, input.lotNo);
        if (existing) {
          await repos.lots.addReceivedQty(existing.id, input.goodQty);
          lot = ensureFound(await repos.lots.findById(existing.id), 'ロット', existing.id);
        } else {
          const lotId = randomUUID();
          lot = {
            id: lotId,
            productId: line.productId,
            productCode: line.productCode,
            productName: line.productName,
            lotNo: input.lotNo,
            expiryDate: input.expiryDate,
            manufacturedDate: input.manufacturedDate ?? null,
            purchaseOrderLineId: line.id,
            receivedQty: input.goodQty,
            onHandQty: input.goodQty,
            status: LOT_STATUS.AVAILABLE,
            isActive: true,
          };
          await repos.lots.save(lot);
        }
        await repos.lots.createMovement({
          lotId: lot.id,
          movementType: 'receipt',
          quantity: input.goodQty,
          sourceType: 'purchase_order_line',
          sourceId: line.id,
          createdBy: actor.id,
        });
      }

      const poLines = await repos.purchaseOrders.findLinesByOrderId(line.purchaseOrderId);
      const allReceived = poLines.every((poLine) => poLine.receivedDate !== null);
      await repos.purchaseOrders.updateStatus(
        line.purchaseOrderId,
        allReceived ? PURCHASE_ORDER_STATUS.RECEIVED : PURCHASE_ORDER_STATUS.PARTIALLY_RECEIVED,
        actor.id,
      );

      let orderLineStatus: string = SALES_ORDER_LINE_STATUS.ARRIVED;
      if (line.salesOrderLineId) {
        await repos.salesOrders.updateLineStatus(
          line.salesOrderLineId,
          SALES_ORDER_LINE_STATUS.ARRIVED,
          actor.id,
        );
        const orderIds = await repos.salesOrders.findOrderIdsByLineIds([line.salesOrderLineId]);
        for (const orderId of orderIds) {
          orderLineStatus = await syncSalesOrderStatus(repos, orderId, actor.id);
        }
      }

      return {
        purchaseOrderId: line.purchaseOrderId,
        purchaseOrderLineId: line.id,
        productId: line.productId,
        orderLineStatus,
        lot,
      };
    }, actor);
  }
}
