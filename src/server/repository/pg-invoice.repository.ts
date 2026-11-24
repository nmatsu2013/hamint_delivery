import { BusinessRuleViolationError } from '../domain/errors/domain.error';
import type {
  InvoiceEntity,
  InvoiceLineEntity,
  InvoiceSummaryEntity,
  PaymentEntity,
} from '../domain/entities/invoice.entity';
import { normalizeInvoiceStatus } from '../domain/entities/status-mapper';
import type { InvoiceStatus } from '../domain/entities/status';
import type {
  IInvoiceRepository,
  InvoiceListParams,
} from '../domain/repositories/invoice.repository.interface';
import { toNumber, type Queryable } from './database';

interface InvoiceRow {
  id: string;
  invoice_no: string;
  customer_id: string;
  customer_name?: string;
  invoice_date: string;
  due_date: string;
  amount: string;
  currency: string;
  status: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface InvoiceLineRow {
  id: string;
  invoice_id: string;
  sales_order_line_id: string | null;
  shipment_line_id: string | null;
  amount: string;
  currency: string;
  product_name?: string | null;
  quantity?: number | null;
  is_active: boolean;
}

interface PaymentRow {
  id: string;
  invoice_id: string;
  paid_date: string;
  paid_amount: string;
  currency: string;
  method: string | null;
  fee: string | null;
  is_active: boolean;
}

function mapInvoiceLine(row: InvoiceLineRow): InvoiceLineEntity {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    salesOrderLineId: row.sales_order_line_id,
    shipmentLineId: row.shipment_line_id,
    amount: toNumber(row.amount),
    currency: row.currency,
    productName: row.product_name ?? undefined,
    quantity: row.quantity ?? undefined,
    isActive: row.is_active,
  };
}

function mapPayment(row: PaymentRow): PaymentEntity {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    paidDate: row.paid_date,
    paidAmount: toNumber(row.paid_amount),
    currency: row.currency,
    method: row.method,
    fee: row.fee === null ? null : toNumber(row.fee),
    isActive: row.is_active,
  };
}

export class PgInvoiceRepository implements IInvoiceRepository {
  constructor(private readonly db: Queryable) {}

  async findById(id: string): Promise<InvoiceEntity | null> {
    const result = await this.db.query<InvoiceRow>(
      `select inv.*, c.clinic_name as customer_name
       from invoices inv
       join customers c on c.id = inv.customer_id
       where inv.id = $1 and inv.is_active`,
      [id],
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return this.hydrate(row);
  }

  async findByInvoiceNo(invoiceNo: string): Promise<InvoiceEntity | null> {
    const result = await this.db.query<{ id: string }>(
      `select id from invoices where invoice_no = $1 and is_active`,
      [invoiceNo],
    );
    const id = result.rows[0]?.id;
    return id ? this.findById(id) : null;
  }

  async findBySalesOrderId(salesOrderId: string): Promise<InvoiceEntity[]> {
    const result = await this.db.query<{ invoice_id: string }>(
      `select distinct il.invoice_id
       from invoice_lines il
       join sales_order_lines sol on sol.id = il.sales_order_line_id
       join invoices inv on inv.id = il.invoice_id
       where sol.sales_order_id = $1 and il.is_active and inv.is_active`,
      [salesOrderId],
    );
    const invoices: InvoiceEntity[] = [];
    for (const row of result.rows) {
      const invoice = await this.findById(row.invoice_id);
      if (invoice) {
        invoices.push(invoice);
      }
    }
    return invoices;
  }

  private async hydrate(row: InvoiceRow): Promise<InvoiceEntity> {
    const lineResult = await this.db.query<InvoiceLineRow>(
      `select il.*, p.product_name, sol.quantity
       from invoice_lines il
       left join sales_order_lines sol on sol.id = il.sales_order_line_id
       left join products p on p.id = sol.product_id
       where il.invoice_id = $1 and il.is_active
       order by il.created_at, il.id`,
      [row.id],
    );
    const paymentResult = await this.db.query<PaymentRow>(
      `select * from payments where invoice_id = $1 and is_active
       order by paid_date asc, created_at asc`,
      [row.id],
    );
    const paidAmount = paymentResult.rows.reduce(
      (total, payment) => total + toNumber(payment.paid_amount),
      0,
    );
    const salesOrderIds = await this.findOrderIdsByInvoiceId(row.id);
    return {
      id: row.id,
      invoiceNo: row.invoice_no,
      customerId: row.customer_id,
      customerName: row.customer_name,
      invoiceDate: row.invoice_date,
      dueDate: row.due_date,
      amount: toNumber(row.amount),
      currency: row.currency,
      status: normalizeInvoiceStatus(row.status),
      isActive: row.is_active,
      lines: lineResult.rows.map(mapInvoiceLine),
      payments: paymentResult.rows.map(mapPayment),
      paidAmount,
      unpaidAmount: Math.max(toNumber(row.amount) - paidAmount, 0),
      salesOrderIds,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async generateInvoiceNo(date: Date): Promise<string> {
    const ymd = date.toISOString().slice(2, 10).replace(/-/g, '');
    const prefix = `inv${ymd}-`;
    await this.db.query(`select pg_advisory_xact_lock(hashtext($1))`, [prefix]);
    const result = await this.db.query<{ next: string }>(
      `select coalesce(max(substring(invoice_no from '[0-9]+$')::int), 0) + 1 as next
       from invoices where invoice_no like $1`,
      [`${prefix}%`],
    );
    return `${prefix}${String(toNumber(result.rows[0]?.next, 1)).padStart(2, '0')}`;
  }

  async save(invoice: InvoiceEntity, lines: InvoiceLineEntity[]): Promise<void> {
    await this.db.query(
      `insert into invoices
        (id, invoice_no, customer_id, invoice_date, due_date, amount, currency, status, is_active)
       values ($1,$2,$3,$4,$5,$6,$7,$8,true)`,
      [
        invoice.id,
        invoice.invoiceNo,
        invoice.customerId,
        invoice.invoiceDate,
        invoice.dueDate,
        invoice.amount,
        invoice.currency,
        invoice.status,
      ],
    );
    for (const line of lines) {
      await this.db.query(
        `insert into invoice_lines
          (id, invoice_id, sales_order_line_id, shipment_line_id, amount, currency, is_active)
         values ($1,$2,$3,$4,$5,$6,true)`,
        [
          line.id,
          invoice.id,
          line.salesOrderLineId,
          line.shipmentLineId,
          line.amount,
          line.currency,
        ],
      );
    }
  }

  async updateStatus(id: string, status: string, actorId?: string): Promise<void> {
    await this.db.query(
      `update invoices set status = $2, updated_by = $3 where id = $1`,
      [id, status, actorId ?? null],
    );
  }

  async savePayment(payment: PaymentEntity): Promise<void> {
    await this.db.query(
      `insert into payments
        (id, invoice_id, paid_date, paid_amount, currency, method, fee, is_active, created_by, updated_by)
       values ($1,$2,$3,$4,$5,$6,$7,true,$8,$8)`,
      [
        payment.id,
        payment.invoiceId,
        payment.paidDate,
        payment.paidAmount,
        payment.currency,
        payment.method,
        payment.fee,
        null,
      ],
    );
  }

  async getTotalPaidAmount(invoiceId: string): Promise<number> {
    const result = await this.db.query<{ total: string }>(
      `select coalesce(sum(paid_amount), 0) as total
       from payments where invoice_id = $1 and is_active`,
      [invoiceId],
    );
    return toNumber(result.rows[0]?.total);
  }

  async findOrderIdsByInvoiceId(invoiceId: string): Promise<string[]> {
    const result = await this.db.query<{ sales_order_id: string }>(
      `select distinct sol.sales_order_id
       from invoice_lines il
       join sales_order_lines sol on sol.id = il.sales_order_line_id
       where il.invoice_id = $1 and il.is_active`,
      [invoiceId],
    );
    return result.rows.map((row) => row.sales_order_id);
  }

  async list(
    params: InvoiceListParams,
  ): Promise<{ items: InvoiceSummaryEntity[]; total: number }> {
    const values: unknown[] = [];
    const conditions: string[] = ['inv.is_active'];
    if (params.status) {
      values.push(params.status);
      conditions.push(`inv.status = $${values.length}`);
    }
    values.push(params.limit, params.offset);
    const limitIndex = values.length - 1;
    const offsetIndex = values.length;

    const result = await this.db.query<
      InvoiceRow & {
        paid_amount: string | null;
        order_nos: string[] | null;
        total_count: string;
      }
    >(
      `select inv.*, c.clinic_name as customer_name,
              coalesce(pay.paid_amount, 0) as paid_amount,
              ord.order_nos,
              count(*) over() as total_count
       from invoices inv
       join customers c on c.id = inv.customer_id
       left join lateral (
         select sum(p.paid_amount) as paid_amount
         from payments p where p.invoice_id = inv.id and p.is_active
       ) pay on true
       left join lateral (
         select array_agg(distinct so.order_no) as order_nos
         from invoice_lines il
         join sales_order_lines sol on sol.id = il.sales_order_line_id
         join sales_orders so on so.id = sol.sales_order_id
         where il.invoice_id = inv.id and il.is_active
       ) ord on true
       where ${conditions.join(' and ')}
       order by inv.invoice_date desc, inv.invoice_no desc
       limit $${limitIndex} offset $${offsetIndex}`,
      values,
    );

    const items = result.rows.map((row) => {
      const amount = toNumber(row.amount);
      const paidAmount = toNumber(row.paid_amount);
      return {
        id: row.id,
        invoiceNo: row.invoice_no,
        customerName: row.customer_name ?? '',
        invoiceDate: row.invoice_date,
        dueDate: row.due_date,
        amount,
        currency: row.currency,
        status: normalizeInvoiceStatus(row.status) as InvoiceStatus,
        paidAmount,
        unpaidAmount: Math.max(amount - paidAmount, 0),
        orderNos: row.order_nos ?? [],
      };
    });
    return { items, total: toNumber(result.rows[0]?.total_count) };
  }

  async countUnpaid(): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      `select count(*) as count from invoices
       where is_active and status in ('請求済', '一部入金')`,
    );
    return toNumber(result.rows[0]?.count);
  }

  async delete(_id: string): Promise<void> {
    throw new BusinessRuleViolationError(
      '確定済みの請求は削除できません。訂正は履歴を残して行ってください。',
    );
  }
}
