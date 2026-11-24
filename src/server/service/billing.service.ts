import { randomUUID } from 'node:crypto';
import {
  BusinessRuleViolationError,
  ValidationError,
} from '../domain/errors/domain.error.js';
import type { Actor } from '../domain/entities/actor.entity.js';
import type {
  CreateInvoiceInput,
  InvoiceEntity,
  InvoiceLineEntity,
  PaymentEntity,
  RecordPaymentInput,
  RecordPaymentResult,
} from '../domain/entities/invoice.entity.js';
import {
  INVOICE_STATUS,
  SALES_ORDER_LINE_STATUS,
} from '../domain/entities/status.js';
import type { IUnitOfWork } from '../domain/repositories/unit-of-work.interface.js';
import { normalizeInvoiceStatus } from '../domain/entities/status-mapper.js';
import { CONSUMPTION_TAX_RATE, clampPageSize, parseOffset } from '../config/constants.js';
import { addDays, dateStringToUtcDate, isValidDateString, todayInTokyo } from '../config/date.js';
import { ensureFound } from './service-support.js';

export interface InvoiceListQuery {
  status?: string;
  limit?: number;
  offset?: number;
}

export class BillingService {
  constructor(private readonly uow: IUnitOfWork) {}

  async list(query: InvoiceListQuery) {
    const limit = clampPageSize(query.limit);
    const offset = parseOffset(query.offset);
    const status = query.status ? normalizeInvoiceStatus(query.status) : undefined;
    const result = await this.uow.repos.invoices.list({
      status,
      limit,
      offset,
    });
    return { ...result, limit, offset };
  }

  async getDetail(id: string): Promise<InvoiceEntity> {
    return ensureFound(await this.uow.repos.invoices.findById(id), '請求', id);
  }

  /** UC-07: 出荷済み受注から請求を作成する。 */
  async createInvoice(input: CreateInvoiceInput, actor: Actor): Promise<InvoiceEntity> {
    if (input.invoiceDate && !isValidDateString(input.invoiceDate)) {
      throw new ValidationError('請求日の形式が不正です');
    }
    if (input.dueDate && !isValidDateString(input.dueDate)) {
      throw new ValidationError('支払期限の形式が不正です');
    }
    return this.uow.run(async (repos) => {
      const order = ensureFound(
        await repos.salesOrders.findById(input.salesOrderId),
        '受注',
        input.salesOrderId,
      );
      const existing = await repos.invoices.findBySalesOrderId(order.id);
      if (existing.length > 0) {
        throw new BusinessRuleViolationError(
          `受注 ${order.orderNo} は既に請求済みです（${existing.map((inv) => inv.invoiceNo).join(', ')}）`,
        );
      }

      const eligibleLines = order.lines.filter(
        (line) =>
          line.lineStatus === SALES_ORDER_LINE_STATUS.SHIPPED ||
          line.lineStatus === SALES_ORDER_LINE_STATUS.COMPLETED,
      );
      if (eligibleLines.length === 0) {
        throw new BusinessRuleViolationError('出荷済みの明細がないため請求を作成できません');
      }

      const invoiceDate = input.invoiceDate ?? todayInTokyo();
      const dueDate = input.dueDate ?? addDays(invoiceDate, 30);
      const invoiceId = randomUUID();
      const lines: InvoiceLineEntity[] = eligibleLines.map((line) => ({
        id: randomUUID(),
        invoiceId,
        salesOrderLineId: line.id,
        shipmentLineId: null,
        amount: line.quantity * line.unitPrice,
        currency: order.currency,
        productName: line.productName,
        quantity: line.quantity,
        isActive: true,
      }));
      const subtotal = lines.reduce((total, line) => total + line.amount, 0);
      const tax = Math.floor(subtotal * CONSUMPTION_TAX_RATE);

      const invoice: InvoiceEntity = {
        id: invoiceId,
        invoiceNo: await repos.invoices.generateInvoiceNo(dateStringToUtcDate(invoiceDate)),
        customerId: order.customerId,
        customerName: order.customerName,
        invoiceDate,
        dueDate,
        amount: subtotal + tax,
        currency: order.currency,
        status: INVOICE_STATUS.ISSUED,
        isActive: true,
        lines,
        payments: [],
        paidAmount: 0,
        unpaidAmount: subtotal + tax,
        salesOrderIds: [order.id],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await repos.invoices.save(invoice, lines);
      return ensureFound(await repos.invoices.findById(invoiceId), '請求', invoiceId);
    }, actor);
  }

  /** UC-07: 入金登録・消込 */
  async recordPayment(input: RecordPaymentInput, actor: Actor): Promise<RecordPaymentResult> {
    if (!Number.isFinite(input.paidAmount) || input.paidAmount <= 0) {
      throw new ValidationError('入金額は0より大きい必要があります');
    }
    if (!isValidDateString(input.paidDate)) {
      throw new ValidationError('入金日の形式が不正です');
    }
    return this.uow.run(async (repos) => {
      const invoice = ensureFound(
        await repos.invoices.findById(input.invoiceId),
        '請求',
        input.invoiceId,
      );
      if (invoice.status === INVOICE_STATUS.PAID) {
        throw new BusinessRuleViolationError('既に入金済みの請求です');
      }
      const payment: PaymentEntity = {
        id: randomUUID(),
        invoiceId: invoice.id,
        paidDate: input.paidDate,
        paidAmount: input.paidAmount,
        currency: invoice.currency,
        method: input.method ?? null,
        fee: input.fee ?? null,
        isActive: true,
      };
      await repos.invoices.savePayment(payment);

      const totalPaid = await repos.invoices.getTotalPaidAmount(invoice.id);
      const completedSalesOrderIds: string[] = [];
      if (totalPaid >= invoice.amount) {
        await repos.invoices.updateStatus(invoice.id, INVOICE_STATUS.PAID, actor.id);
        const orderIds = await repos.invoices.findOrderIdsByInvoiceId(invoice.id);
        for (const orderId of orderIds) {
          const lines = await repos.salesOrders.findLinesByOrderId(orderId);
          for (const line of lines) {
            await repos.salesOrders.updateLineStatus(
              line.id,
              SALES_ORDER_LINE_STATUS.COMPLETED,
              actor.id,
            );
          }
          await repos.salesOrders.updateStatus(orderId, '完了', actor.id);
          completedSalesOrderIds.push(orderId);
        }
      } else if (totalPaid > 0) {
        await repos.invoices.updateStatus(invoice.id, INVOICE_STATUS.PARTIALLY_PAID, actor.id);
      }

      return {
        invoice: ensureFound(await repos.invoices.findById(invoice.id), '請求', invoice.id),
        completedSalesOrderIds,
      };
    }, actor);
  }

  /** F-73: 未入金額は保存せず請求金額と入金合計から算出する。 */
  async getUnpaidBalance(invoiceId: string): Promise<number> {
    const invoice = await this.getDetail(invoiceId);
    const totalPaid = await this.uow.repos.invoices.getTotalPaidAmount(invoiceId);
    return Math.max(invoice.amount - totalPaid, 0);
  }

  /** AT-27: 確定済み請求の物理削除は拒否される。 */
  async deleteInvoice(id: string): Promise<void> {
    await this.uow.repos.invoices.delete(id);
  }
}
