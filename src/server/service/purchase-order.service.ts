import { randomUUID } from 'node:crypto';
import {
  BusinessRuleViolationError,
  ValidationError,
} from '../domain/errors/domain.error.js';
import type { Actor } from '../domain/entities/actor.entity.js';
import type {
  CreatePurchaseOrderInput,
  PurchaseOrderEntity,
  PurchaseOrderLineEntity,
} from '../domain/entities/purchase-order.entity.js';
import { SALES_ORDER_LINE_STATUS, PURCHASE_ORDER_STATUS } from '../domain/entities/status.js';
import { normalizePurchaseOrderStatus } from '../domain/entities/status-mapper.js';
import type { IUnitOfWork } from '../domain/repositories/unit-of-work.interface.js';
import { clampPageSize, parseOffset } from '../config/constants.js';
import { isValidDateString, todayAsUtcDate, todayInTokyo } from '../config/date.js';
import { ensureFound, syncSalesOrderStatus } from './service-support.js';

export interface PurchaseOrderListQuery {
  status?: string;
  limit?: number;
  offset?: number;
}

export class PurchaseOrderService {
  constructor(private readonly uow: IUnitOfWork) {}

  async list(query: PurchaseOrderListQuery) {
    const limit = clampPageSize(query.limit);
    const offset = parseOffset(query.offset);
    const status = query.status ? normalizePurchaseOrderStatus(query.status) : undefined;
    const result = await this.uow.repos.purchaseOrders.list({ status, limit, offset });
    return { ...result, limit, offset };
  }

  async getDetail(id: string): Promise<PurchaseOrderEntity> {
    return ensureFound(await this.uow.repos.purchaseOrders.findById(id), '発注', id);
  }

  async findByPoNo(poNo: string): Promise<PurchaseOrderEntity> {
    return ensureFound(await this.uow.repos.purchaseOrders.findByPoNo(poNo), '発注', poNo);
  }

  /** UC-03: 受注明細から仕入先ごとに発注を作成・確定する。 */
  async createAndConfirmPo(
    input: CreatePurchaseOrderInput,
    actor: Actor,
  ): Promise<PurchaseOrderEntity[]> {
    if (input.salesOrderLineIds.length === 0) {
      throw new ValidationError('発注対象の受注明細を1件以上指定してください');
    }
    if (input.promisedDate && !isValidDateString(input.promisedDate)) {
      throw new ValidationError('納品回答日の形式が不正です');
    }

    return this.uow.run(async (repos) => {
      const lines = await repos.salesOrders.findLinesByIds(input.salesOrderLineIds);
      if (lines.length !== new Set(input.salesOrderLineIds).size) {
        throw new ValidationError('存在しない受注明細が含まれています');
      }
      for (const line of lines) {
        if (line.lineStatus !== SALES_ORDER_LINE_STATUS.RECEIVED) {
          throw new BusinessRuleViolationError(
            `受注明細 ${line.id} は「受付」ではないため発注できません`,
          );
        }
        const existing = await repos.purchaseOrders.findByOrderLineId(line.id);
        if (existing) {
          throw new BusinessRuleViolationError(
            `受注明細 ${line.id} は既に発注 ${existing.poNo} に紐づいています`,
          );
        }
        if (!line.supplierId) {
          throw new ValidationError(`製品 ${line.productId} の仕入先が設定されていません`);
        }
      }

      const today = todayInTokyo();
      const groups = new Map<string, typeof lines>();
      for (const line of lines) {
        const supplierId = line.supplierId as string;
        const group = groups.get(supplierId) ?? [];
        group.push(line);
        groups.set(supplierId, group);
      }

      const created: PurchaseOrderEntity[] = [];
      for (const [supplierId, groupLines] of groups) {
        const poId = randomUUID();
        const poLines: PurchaseOrderLineEntity[] = [];
        let currency = '';
        let totalAmount = 0;
        for (const line of groupLines) {
          const supplierPrice = await repos.prices.resolveSupplierCost(line.productId, today);
          if (!supplierPrice) {
            throw new BusinessRuleViolationError(
              `製品 ${line.productId} の有効な仕入価格が設定されていません`,
            );
          }
          if (currency && currency !== supplierPrice.currency) {
            throw new BusinessRuleViolationError(
              '同一仕入先の発注で通貨が混在しています。発注を分けてください。',
            );
          }
          currency = supplierPrice.currency;
          totalAmount += line.quantity * supplierPrice.cost;
          poLines.push({
            id: randomUUID(),
            purchaseOrderId: poId,
            productId: line.productId,
            productCode: line.productCode,
            productName: line.productName,
            modelNo: line.modelNo,
            quantity: line.quantity,
            unitCost: supplierPrice.cost,
            currency: supplierPrice.currency,
            salesOrderLineId: line.id,
            appliedHsCode: null,
            dutyRate: null,
            dutyAmount: null,
            dutyCurrency: 'JPY',
            receivedDate: null,
            inspectorId: null,
            goodQty: null,
            defectQty: null,
            damagedQty: null,
            claimStatus: null,
            claimNote: null,
            isActive: true,
          });
        }

        const po: PurchaseOrderEntity = {
          id: poId,
          poNo: await repos.purchaseOrders.generatePoNo(todayAsUtcDate()),
          supplierId,
          orderedDate: today,
          promisedDate: input.promisedDate ?? null,
          currency: currency || 'JPY',
          totalAmount,
          status: PURCHASE_ORDER_STATUS.ORDERED,
          note: input.note ?? null,
          isActive: true,
          lines: poLines,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await repos.purchaseOrders.save(po);
        for (const line of groupLines) {
          await repos.salesOrders.updateLineStatus(
            line.id,
            SALES_ORDER_LINE_STATUS.ORDERED,
            actor.id,
          );
        }
        created.push(ensureFound(await repos.purchaseOrders.findById(poId), '発注', poId));
      }

      const orderIds = await repos.salesOrders.findOrderIdsByLineIds(input.salesOrderLineIds);
      for (const orderId of orderIds) {
        await syncSalesOrderStatus(repos, orderId, actor.id);
      }
      return created;
    }, actor);
  }
}
