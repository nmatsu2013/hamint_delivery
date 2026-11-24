import { randomUUID } from 'node:crypto';
import {
  BusinessRuleViolationError,
  ValidationError,
} from '../domain/errors/domain.error';
import type { Actor } from '../domain/entities/actor.entity';
import type {
  CreateSalesOrderInput,
  SalesOrderEntity,
  SalesOrderLineEntity,
} from '../domain/entities/sales-order.entity';
import { calculateTotalAmount } from '../domain/entities/sales-order.entity';
import { SALES_ORDER_LINE_STATUS } from '../domain/entities/status';
import { normalizeSalesOrderStatus } from '../domain/entities/status-mapper';
import type { IUnitOfWork } from '../domain/repositories/unit-of-work.interface';
import type { PurchaseOrderEntity } from '../domain/entities/purchase-order.entity';
import type { ImportApplicationEntity } from '../domain/entities/import-application.entity';
import type { ShipmentEntity } from '../domain/entities/shipment.entity';
import type { InvoiceEntity } from '../domain/entities/invoice.entity';
import { isValidDateString, todayAsUtcDate, todayInTokyo } from '../config/date';
import { clampPageSize, parseOffset } from '../config/constants';
import { ensureFound, ensurePositiveInteger } from './service-support';
import { PriceService } from './price.service';

export interface SalesOrderListQuery {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface SalesOrderListResult {
  items: Awaited<ReturnType<IUnitOfWork['repos']['salesOrders']['list']>>['items'];
  total: number;
  limit: number;
  offset: number;
}

export interface ProgressStep {
  key: string;
  label: string;
  completed: boolean;
  completedAt: string | null;
}

export interface SalesOrderFullDetail {
  order: SalesOrderEntity;
  purchaseOrders: PurchaseOrderEntity[];
  importApplications: ImportApplicationEntity[];
  shipments: ShipmentEntity[];
  invoices: InvoiceEntity[];
  progress: ProgressStep[];
}

export class SalesOrderService {
  private readonly priceService: PriceService;

  constructor(private readonly uow: IUnitOfWork) {
    this.priceService = new PriceService(uow);
  }

  async list(query: SalesOrderListQuery): Promise<SalesOrderListResult> {
    const limit = clampPageSize(query.limit);
    const offset = parseOffset(query.offset);
    const status = query.status ? normalizeSalesOrderStatus(query.status) : undefined;
    const result = await this.uow.repos.salesOrders.list({
      status,
      search: query.search?.trim() || undefined,
      limit,
      offset,
    });
    return { ...result, limit, offset };
  }

  async getDetail(id: string): Promise<SalesOrderEntity> {
    return ensureFound(await this.uow.repos.salesOrders.findById(id), '受注', id);
  }

  /** 受注明細画面用：関連する発注・輸入申請・配送・請求と8段階の進捗を返す。 */
  async getFullDetail(id: string): Promise<SalesOrderFullDetail> {
    const repos = this.uow.repos;
    const order = await this.getDetail(id);

    const purchaseOrders: PurchaseOrderEntity[] = [];
    for (const line of order.lines) {
      const po = await repos.purchaseOrders.findByOrderLineId(line.id);
      if (po && !purchaseOrders.some((existing) => existing.id === po.id)) {
        purchaseOrders.push(po);
      }
    }

    const importApplications: ImportApplicationEntity[] = [];
    for (const po of purchaseOrders) {
      const application = await repos.importApplications.findByPurchaseOrderId(po.id);
      if (application) {
        importApplications.push(application);
      }
    }

    const shipments = await repos.shipments.findBySalesOrderId(order.id);
    const invoices = await repos.invoices.findBySalesOrderId(order.id);

    const international = shipments.filter((shipment) => shipment.direction === 'international');
    const domestic = shipments.filter((shipment) => shipment.direction === 'domestic');
    const allPoLines = purchaseOrders.flatMap((po) => po.lines);
    const progress: ProgressStep[] = [
      {
        key: 'order',
        label: '受注登録済',
        completed: true,
        completedAt: order.orderDate,
      },
      {
        key: 'purchase',
        label: '発注確定済',
        completed: purchaseOrders.some((po) => po.status !== '下書き'),
        completedAt: purchaseOrders.find((po) => po.status !== '下書き')?.orderedDate ?? null,
      },
      {
        key: 'import',
        label: '輸入申請承認',
        completed: importApplications.some((application) => application.status === '承認'),
        completedAt:
          importApplications.find((application) => application.status === '承認')?.confirmedDate ??
          null,
      },
      {
        key: 'transport',
        label: '輸送・通関許可',
        completed:
          international.some((shipment) => shipment.deliveredDate !== null) ||
          importApplications.some((application) => application.importPermitDate !== null),
        completedAt:
          international.find((shipment) => shipment.deliveredDate !== null)?.deliveredDate ??
          importApplications.find((application) => application.importPermitDate !== null)
            ?.importPermitDate ??
          null,
      },
      {
        key: 'warehouse',
        label: '入庫・検品済',
        completed: allPoLines.length > 0 && allPoLines.every((line) => line.receivedDate !== null),
        completedAt:
          allPoLines.length > 0 && allPoLines.every((line) => line.receivedDate !== null)
            ? (allPoLines[0]?.receivedDate ?? null)
            : null,
      },
      {
        key: 'shipped',
        label: '国内出荷済',
        completed: domestic.some((shipment) => shipment.shippedDate !== null),
        completedAt: domestic.find((shipment) => shipment.shippedDate !== null)?.shippedDate ?? null,
      },
      {
        key: 'delivered',
        label: '納品完了',
        completed: domestic.some((shipment) => shipment.deliveredDate !== null),
        completedAt:
          domestic.find((shipment) => shipment.deliveredDate !== null)?.deliveredDate ?? null,
      },
      {
        key: 'paid',
        label: '入金消込完了',
        completed: invoices.some((invoice) => invoice.status === '入金済'),
        completedAt: null,
      },
    ];

    return { order, purchaseOrders, importApplications, shipments, invoices, progress };
  }

  /** UC-02: 受注登録 */
  async createOrder(input: CreateSalesOrderInput, actor: Actor): Promise<SalesOrderEntity> {
    if (input.lines.length === 0) {
      throw new ValidationError('明細を1件以上入力してください');
    }
    for (const line of input.lines) {
      ensurePositiveInteger(line.quantity, '数量');
    }
    if (input.requestedDate && !isValidDateString(input.requestedDate)) {
      throw new ValidationError('希望納期の形式が不正です', { requestedDate: input.requestedDate });
    }

    return this.uow.run(async (repos) => {
      const customer = ensureFound(
        await repos.customers.findById(input.customerId),
        '顧客',
        input.customerId,
      );
      const shipTo = ensureFound(
        await repos.customers.findAddress(input.shipToId),
        '配送先',
        input.shipToId,
      );
      if (shipTo.customerId !== input.customerId) {
        throw new ValidationError('配送先が指定した顧客に属していません');
      }

      const today = todayInTokyo();
      const orderId = randomUUID();
      const lines: SalesOrderLineEntity[] = [];
      for (const inputLine of input.lines) {
        const product = await repos.products.findById(inputLine.productId);
        if (!product) {
          throw new ValidationError('有効な製品を指定してください', {
            productId: inputLine.productId,
          });
        }
        if (!product.isActive) {
          throw new ValidationError('無効な製品は受注できません', {
            productId: inputLine.productId,
          });
        }
        const unitPrice = await this.priceService.resolveWith(
          repos,
          input.customerId,
          inputLine.productId,
          today,
        );
        lines.push({
          id: randomUUID(),
          salesOrderId: orderId,
          productId: product.id,
          productCode: product.productCode,
          productName: product.productName,
          modelNo: product.modelNo,
          specNote: product.specNote,
          supplierId: product.supplierId,
          quantity: inputLine.quantity,
          unitPrice,
          currency: 'JPY',
          lineStatus: SALES_ORDER_LINE_STATUS.RECEIVED,
          shippedQuantity: 0,
          isActive: true,
        });
      }

      const order: SalesOrderEntity = {
        id: orderId,
        orderNo: await repos.salesOrders.generateOrderNo(todayAsUtcDate()),
        orderDate: today,
        customerId: customer.id,
        customerName: customer.clinicName,
        shipToId: shipTo.id,
        shipToName: shipTo.shipToName,
        requestedDate: input.requestedDate ?? null,
        status: '受付',
        totalAmount: calculateTotalAmount(lines),
        currency: 'JPY',
        note: input.note ?? null,
        isActive: true,
        lines,
        paymentStatus: '未請求',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await repos.salesOrders.save(order);
      return order;
    }, actor);
  }

  /** 受注取消（未出荷のみ） */
  async cancelOrder(id: string, actor: Actor): Promise<SalesOrderEntity> {
    return this.uow.run(async (repos) => {
      const order = ensureFound(await repos.salesOrders.findById(id), '受注', id);
      if (order.status === '取消') {
        return order;
      }
      const blocked = order.lines.some(
        (line) => line.lineStatus === '出荷済' || line.lineStatus === '完了',
      );
      if (blocked) {
        throw new BusinessRuleViolationError('出荷済みの受注は取消できません');
      }
      const invoices = await repos.invoices.findBySalesOrderId(id);
      if (invoices.length > 0) {
        throw new BusinessRuleViolationError('請求済みの受注は取消できません');
      }
      await repos.salesOrders.cancel(id, actor.id);
      return ensureFound(await repos.salesOrders.findById(id), '受注', id);
    }, actor);
  }
}
