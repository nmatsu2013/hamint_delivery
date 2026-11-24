import { randomUUID } from 'node:crypto';
import {
  BusinessRuleViolationError,
  ValidationError,
} from '../domain/errors/domain.error';
import type { Actor } from '../domain/entities/actor.entity';
import type {
  CreateDomesticShipmentInput,
  CreateInternationalShipmentInput,
  DomesticShipmentResult,
  ShipmentEntity,
  ShipmentLineEntity,
} from '../domain/entities/shipment.entity';
import {
  SALES_ORDER_LINE_STATUS,
  SHIPMENT_DIRECTION,
  SHIPMENT_STATUS,
} from '../domain/entities/status';
import { normalizeShipmentDirection } from '../domain/entities/status-mapper';
import type { IUnitOfWork } from '../domain/repositories/unit-of-work.interface';
import { clampPageSize, parseOffset } from '../config/constants';
import { dateStringToUtcDate, isValidDateString, todayInTokyo } from '../config/date';
import { ensureFound, ensurePositiveInteger, syncSalesOrderStatus } from './service-support';

export interface ShipmentListQuery {
  direction?: string;
  limit?: number;
  offset?: number;
}

export class ShipmentService {
  constructor(private readonly uow: IUnitOfWork) {}

  async list(query: ShipmentListQuery) {
    const limit = clampPageSize(query.limit);
    const offset = parseOffset(query.offset);
    const direction = query.direction ? normalizeShipmentDirection(query.direction) : undefined;
    const result = await this.uow.repos.shipments.list({ direction, limit, offset });
    return { ...result, limit, offset };
  }

  async getDetail(id: string): Promise<ShipmentEntity> {
    return ensureFound(await this.uow.repos.shipments.findById(id), '配送', id);
  }

  /** UC-04: 国際輸送の発送登録。同じ発注に対しては冪等に既存を返す。 */
  async registerInternationalDeparture(
    input: CreateInternationalShipmentInput,
    actor: Actor,
  ): Promise<ShipmentEntity> {
    if (!input.carrier.trim() || !input.blAwbNo.trim()) {
      throw new ValidationError('配送業者とAWB/BL番号は必須です');
    }
    if (!isValidDateString(input.shippedDate)) {
      throw new ValidationError('発送日の形式が不正です');
    }
    return this.uow.run(async (repos) => {
      const po = ensureFound(
        await repos.purchaseOrders.findById(input.purchaseOrderId),
        '発注',
        input.purchaseOrderId,
      );
      const existing = await repos.shipments.findByPurchaseOrderId(po.id);
      if (existing) {
        return existing;
      }
      const shipmentId = randomUUID();
      const shipment: ShipmentEntity = {
        id: shipmentId,
        shipmentNo: await repos.shipments.generateShipmentNo(
          SHIPMENT_DIRECTION.INTERNATIONAL,
          dateStringToUtcDate(input.shippedDate),
        ),
        direction: SHIPMENT_DIRECTION.INTERNATIONAL,
        salesOrderId: null,
        shipToId: null,
        purchaseOrderId: po.id,
        shippedDate: input.shippedDate,
        carrier: input.carrier,
        trackingNo: input.blAwbNo,
        deliveredDate: null,
        status: SHIPMENT_STATUS.SHIPPED,
        transportMode: input.transportMode ?? null,
        blAwbNo: input.blAwbNo,
        etd: input.etd ?? null,
        eta: input.eta ?? null,
        isActive: true,
        lines: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const lines: ShipmentLineEntity[] = po.lines.map((line) => ({
        id: randomUUID(),
        shipmentId,
        salesOrderLineId: null,
        purchaseOrderLineId: line.id,
        lotId: null,
        quantity: line.quantity,
        isActive: true,
      }));
      await repos.shipments.save(shipment, lines);

      const orderIds: string[] = [];
      for (const line of po.lines) {
        if (line.salesOrderLineId) {
          await repos.salesOrders.updateLineStatus(
            line.salesOrderLineId,
            SALES_ORDER_LINE_STATUS.IN_TRANSIT,
            actor.id,
          );
          orderIds.push(...(await repos.salesOrders.findOrderIdsByLineIds([line.salesOrderLineId])));
        }
      }
      for (const orderId of new Set(orderIds)) {
        await syncSalesOrderStatus(repos, orderId, actor.id);
      }
      return ensureFound(await repos.shipments.findById(shipmentId), '配送', shipmentId);
    }, actor);
  }

  /** UC-06: 国内出荷・FIFOロット引当 */
  async shipDomesticOrder(
    input: CreateDomesticShipmentInput,
    actor: Actor,
  ): Promise<DomesticShipmentResult> {
    if (!input.carrier.trim() || !input.trackingNo.trim()) {
      throw new ValidationError('配送業者と追跡番号は必須です');
    }
    if (!isValidDateString(input.shippedDate)) {
      throw new ValidationError('発送日の形式が不正です');
    }
    if (input.lines.length === 0) {
      throw new ValidationError('出荷明細を1件以上指定してください');
    }
    for (const line of input.lines) {
      ensurePositiveInteger(line.quantity, '出荷数量');
    }

    return this.uow.run(async (repos) => {
      const order = ensureFound(
        await repos.salesOrders.findById(input.salesOrderId),
        '受注',
        input.salesOrderId,
      );
      // AT-21: 同一受注・同一追跡番号の再送は処理済みとして返す。
      const existing = await repos.shipments.findBySalesOrderAndTracking(
        order.id,
        input.trackingNo,
      );
      if (existing) {
        return { shipment: existing, alreadyProcessed: true };
      }

      const today = todayInTokyo();
      const orderLineMap = new Map(order.lines.map((line) => [line.id, line]));
      for (const inputLine of input.lines) {
        const orderLine = orderLineMap.get(inputLine.salesOrderLineId);
        if (!orderLine) {
          throw new ValidationError(`受注明細 ${inputLine.salesOrderLineId} はこの受注に属していません`);
        }
        if (orderLine.lineStatus === SALES_ORDER_LINE_STATUS.CANCELLED) {
          throw new BusinessRuleViolationError('取消済みの明細は出荷できません');
        }
        const shippedQty = await repos.shipments.getShippedQuantityByLine(orderLine.id);
        const remaining = orderLine.quantity - Math.max(shippedQty, orderLine.shippedQuantity);
        if (inputLine.quantity > remaining) {
          throw new BusinessRuleViolationError(
            `受注数量を超える出荷はできません（残数 ${remaining}）`,
          );
        }

        const lot = ensureFound(await repos.lots.findById(inputLine.lotId), 'ロット', inputLine.lotId);
        if (lot.productId !== orderLine.productId) {
          throw new ValidationError('ロットの製品が受注明細の製品と一致しません');
        }
        if (lot.status !== '使用可') {
          throw new BusinessRuleViolationError(
            `ロット ${lot.lotNo} は「使用可」ではないため出荷できません`,
          );
        }
        if (lot.expiryDate < today) {
          throw new BusinessRuleViolationError(`使用期限切れのロットは出荷できません: ${lot.lotNo}`);
        }
        if (lot.onHandQty < inputLine.quantity) {
          throw new BusinessRuleViolationError(
            `ロット ${lot.lotNo} の在庫が不足しています（在庫 ${lot.onHandQty}）`,
          );
        }

        const fifo = await repos.lots.findAvailableLotsByProductFIFO(lot.productId, today);
        const earlierLot = fifo.find(
          (candidate) =>
            candidate.id !== lot.id &&
            candidate.expiryDate < lot.expiryDate &&
            candidate.onHandQty > 0,
        );
        if (earlierLot && !input.fifoOverrideReason?.trim()) {
          throw new BusinessRuleViolationError(
            `先入先出ではロット ${earlierLot.lotNo} を優先してください。違うロットを選ぶ場合は理由を入力してください。`,
          );
        }
      }

      const shipmentId = randomUUID();
      const lines: ShipmentLineEntity[] = input.lines.map((line) => ({
        id: randomUUID(),
        shipmentId,
        salesOrderLineId: line.salesOrderLineId,
        purchaseOrderLineId: null,
        lotId: line.lotId,
        quantity: line.quantity,
        isActive: true,
      }));
      const shipment: ShipmentEntity = {
        id: shipmentId,
        shipmentNo: await repos.shipments.generateShipmentNo(
          SHIPMENT_DIRECTION.DOMESTIC,
          dateStringToUtcDate(input.shippedDate),
        ),
        direction: SHIPMENT_DIRECTION.DOMESTIC,
        salesOrderId: order.id,
        shipToId: order.shipToId,
        purchaseOrderId: null,
        shippedDate: input.shippedDate,
        carrier: input.carrier,
        trackingNo: input.trackingNo,
        deliveredDate: null,
        status: SHIPMENT_STATUS.SHIPPED,
        transportMode: null,
        blAwbNo: null,
        etd: null,
        eta: null,
        isActive: true,
        lines,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await repos.shipments.save(shipment, lines);

      for (const [index, inputLine] of input.lines.entries()) {
        const shipmentLine = lines[index];
        if (!shipmentLine) {
          continue;
        }
        await repos.lots.updateOnHandQty(inputLine.lotId, -inputLine.quantity);
        await repos.lots.createMovement({
          lotId: inputLine.lotId,
          movementType: 'shipment',
          quantity: inputLine.quantity,
          sourceType: 'shipment_line',
          sourceId: shipmentLine.id,
          customerId: order.customerId,
          shipToId: order.shipToId,
          createdBy: actor.id,
        });
        const shippedTotal = await repos.shipments.getShippedQuantityByLine(
          inputLine.salesOrderLineId,
        );
        const orderLine = orderLineMap.get(inputLine.salesOrderLineId);
        if (orderLine && shippedTotal >= orderLine.quantity) {
          await repos.salesOrders.updateLineStatus(
            orderLine.id,
            SALES_ORDER_LINE_STATUS.SHIPPED,
            actor.id,
          );
        }
      }
      await syncSalesOrderStatus(repos, order.id, actor.id);
      const saved = ensureFound(await repos.shipments.findById(shipmentId), '配送', shipmentId);
      return { shipment: saved, alreadyProcessed: false };
    }, actor);
  }

  /** 納品日の記録 */
  async markDelivered(id: string, deliveredDate: string, actor: Actor): Promise<ShipmentEntity> {
    if (!isValidDateString(deliveredDate)) {
      throw new ValidationError('納品日の形式が不正です');
    }
    return this.uow.run(async (repos) => {
      const shipment = ensureFound(await repos.shipments.findById(id), '配送', id);
      if (shipment.deliveredDate) {
        return shipment;
      }
      await repos.shipments.markDelivered(id, deliveredDate, actor.id);
      return ensureFound(await repos.shipments.findById(id), '配送', id);
    }, actor);
  }
}
