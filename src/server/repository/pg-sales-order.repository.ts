import type {
  SalesOrderEntity,
  SalesOrderLineEntity,
  SalesOrderSummaryEntity,
  PaymentStatusLabel,
} from '../domain/entities/sales-order.entity';
import type {
  SalesOrderListParams,
  ISalesOrderRepository,
} from '../domain/repositories/sales-order.repository.interface';
import {
  normalizeSalesOrderLineStatus,
  normalizeSalesOrderStatus,
} from '../domain/entities/status-mapper';
import type { SalesOrderStatus } from '../domain/entities/status';
import {
  toNumber,
  toStringValue,
  type Queryable,
} from './database';

const PAYMENT_LATERAL = `
  left join lateral (
    select count(distinct inv.id) as invoice_count,
           count(distinct inv.id) filter (where inv.status = '入金済') as paid_count
    from sales_order_lines sol2
    join invoice_lines il on il.sales_order_line_id = sol2.id and il.is_active
    join invoices inv on inv.id = il.invoice_id and inv.is_active
    where sol2.sales_order_id = so.id and sol2.is_active
  ) pay on true
`;

function paymentStatusSql(): string {
  return `case
    when pay.invoice_count is null or pay.invoice_count = 0 then '未請求'
    when pay.paid_count = pay.invoice_count then '入金済'
    else '未入金（請求済）'
  end`;
}

function mapPaymentStatus(value: unknown): PaymentStatusLabel {
  if (value === '入金済') return '入金済';
  if (value === '未入金（請求済）') return '未入金（請求済）';
  return '未請求';
}

interface OrderRow {
  id: string;
  order_no: string;
  order_date: string;
  customer_id: string;
  clinic_name: string;
  ship_to_id: string;
  ship_to_name: string;
  requested_date: string | null;
  status: string;
  total_amount: string;
  currency: string;
  note: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  payment_status?: string;
}

export interface LineRow {
  id: string;
  sales_order_id: string;
  product_id: string;
  product_code: string;
  product_name: string;
  model_no: string;
  spec_note: string | null;
  supplier_id: string;
  quantity: number;
  unit_price: string;
  currency: string;
  line_status: string;
  shipped_quantity: string | null;
  is_active: boolean;
}

function mapLine(row: LineRow): SalesOrderLineEntity {
  return {
    id: row.id,
    salesOrderId: row.sales_order_id,
    productId: row.product_id,
    productCode: row.product_code,
    productName: row.product_name,
    modelNo: row.model_no,
    specNote: row.spec_note,
    supplierId: row.supplier_id,
    quantity: row.quantity,
    unitPrice: toNumber(row.unit_price),
    currency: row.currency,
    lineStatus: normalizeSalesOrderLineStatus(row.line_status),
    shippedQuantity: toNumber(row.shipped_quantity),
    isActive: row.is_active,
  };
}

const LINE_SELECT = `
  select sol.*, p.product_code, p.product_name, p.model_no, p.spec_note, p.supplier_id,
         coalesce(sl.shipped_quantity, 0) as shipped_quantity
  from sales_order_lines sol
  join products p on p.id = sol.product_id
  left join (
    select sales_order_line_id, sum(quantity) as shipped_quantity
    from shipment_lines where is_active group by sales_order_line_id
  ) sl on sl.sales_order_line_id = sol.id
`;

export class PgSalesOrderRepository implements ISalesOrderRepository {
  constructor(private readonly db: Queryable) {}

  async findById(id: string): Promise<SalesOrderEntity | null> {
    const orderResult = await this.db.query<OrderRow>(
      `select so.*, c.clinic_name, ca.ship_to_name, ${paymentStatusSql()} as payment_status
       from sales_orders so
       join customers c on c.id = so.customer_id
       join customer_addresses ca on ca.id = so.ship_to_id
       ${PAYMENT_LATERAL}
       where so.id = $1 and so.is_active`,
      [id],
    );
    const row = orderResult.rows[0];
    if (!row) {
      return null;
    }
    const lines = await this.findLinesByOrderId(row.id);
    return {
      id: row.id,
      orderNo: row.order_no,
      orderDate: row.order_date,
      customerId: row.customer_id,
      customerName: row.clinic_name,
      shipToId: row.ship_to_id,
      shipToName: row.ship_to_name,
      requestedDate: row.requested_date,
      status: normalizeSalesOrderStatus(row.status),
      totalAmount: toNumber(row.total_amount),
      currency: row.currency,
      note: row.note,
      isActive: row.is_active,
      lines,
      paymentStatus: mapPaymentStatus(row.payment_status),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async findByOrderNo(orderNo: string): Promise<SalesOrderEntity | null> {
    const result = await this.db.query<{ id: string }>(
      `select id from sales_orders where order_no = $1 and is_active`,
      [orderNo],
    );
    const id = result.rows[0]?.id;
    return id ? this.findById(id) : null;
  }

  async list(
    params: SalesOrderListParams,
  ): Promise<{ items: SalesOrderSummaryEntity[]; total: number }> {
    const values: unknown[] = [];
    const conditions: string[] = ['so.is_active'];
    if (params.status) {
      values.push(params.status);
      conditions.push(`so.status = $${values.length}`);
    }
    if (params.search) {
      values.push(`%${params.search}%`);
      const index = values.length;
      conditions.push(`(
        c.clinic_name ilike $${index}
        or so.order_no ilike $${index}
        or exists (
          select 1 from sales_order_lines sol3
          join products p3 on p3.id = sol3.product_id
          where sol3.sales_order_id = so.id and sol3.is_active and p3.product_name ilike $${index}
        )
      )`);
    }
    values.push(params.limit, params.offset);
    const limitIndex = values.length - 1;
    const offsetIndex = values.length;

    const result = await this.db.query<
      OrderRow & {
        quantity: string | null;
        main_product_name: string | null;
        line_count: string;
        total_count: string;
      }
    >(
      `select so.*, c.clinic_name, ca.ship_to_name,
              coalesce(l.quantity, 0) as quantity,
              l.main_product_name,
              coalesce(l.line_count, 0) as line_count,
              count(*) over() as total_count,
              ${paymentStatusSql()} as payment_status
       from sales_orders so
       join customers c on c.id = so.customer_id
       join customer_addresses ca on ca.id = so.ship_to_id
       left join lateral (
         select sum(sol.quantity) as quantity,
                (array_agg(p.product_name order by p.product_code, sol.id))[1] as main_product_name,
                count(*) as line_count
         from sales_order_lines sol
         join products p on p.id = sol.product_id
         where sol.sales_order_id = so.id and sol.is_active
       ) l on true
       ${PAYMENT_LATERAL}
       where ${conditions.join(' and ')}
       order by so.order_date desc, so.order_no desc
       limit $${limitIndex} offset $${offsetIndex}`,
      values,
    );

    const items = result.rows.map((row) => ({
      id: row.id,
      orderNo: row.order_no,
      orderDate: row.order_date,
      customerId: row.customer_id,
      customerName: row.clinic_name,
      shipToId: row.ship_to_id,
      shipToName: row.ship_to_name,
      requestedDate: row.requested_date,
      status: normalizeSalesOrderStatus(row.status) as SalesOrderStatus,
      totalAmount: toNumber(row.total_amount),
      currency: row.currency,
      quantity: toNumber(row.quantity),
      mainProductName: toStringValue(row.main_product_name),
      lineCount: toNumber(row.line_count),
      paymentStatus: mapPaymentStatus(row.payment_status),
    }));
    return { items, total: toNumber(result.rows[0]?.total_count) };
  }

  async generateOrderNo(date: Date): Promise<string> {
    const ymd = date.toISOString().slice(2, 10).replace(/-/g, '');
    const prefix = `so${ymd}-`;
    await this.db.query(`select pg_advisory_xact_lock(hashtext($1))`, [prefix]);
    const result = await this.db.query<{ next: string }>(
      `select coalesce(max(substring(order_no from '[0-9]+$')::int), 0) + 1 as next
       from sales_orders where order_no like $1`,
      [`${prefix}%`],
    );
    const next = toNumber(result.rows[0]?.next, 1);
    return `${prefix}${String(next).padStart(2, '0')}`;
  }

  async save(order: SalesOrderEntity): Promise<void> {
    await this.db.query(
      `insert into sales_orders
        (id, order_no, order_date, customer_id, ship_to_id, requested_date, status,
         total_amount, currency, note, is_active)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true)`,
      [
        order.id,
        order.orderNo,
        order.orderDate,
        order.customerId,
        order.shipToId,
        order.requestedDate,
        order.status,
        order.totalAmount,
        order.currency,
        order.note,
      ],
    );
    for (const line of order.lines) {
      await this.db.query(
        `insert into sales_order_lines
          (id, sales_order_id, product_id, quantity, unit_price, currency, line_status, is_active)
         values ($1,$2,$3,$4,$5,$6,$7,true)`,
        [
          line.id,
          order.id,
          line.productId,
          line.quantity,
          line.unitPrice,
          line.currency,
          line.lineStatus,
        ],
      );
    }
  }

  async updateStatus(id: string, status: string, actorId?: string): Promise<void> {
    await this.db.query(
      `update sales_orders set status = $2, updated_by = $3 where id = $1`,
      [id, status, actorId ?? null],
    );
  }

  async updateLineStatus(id: string, status: string, actorId?: string): Promise<void> {
    await this.db.query(
      `update sales_order_lines set line_status = $2, updated_by = $3 where id = $1`,
      [id, status, actorId ?? null],
    );
  }

  async findLinesByIds(ids: string[]): Promise<SalesOrderLineEntity[]> {
    if (ids.length === 0) {
      return [];
    }
    const result = await this.db.query<LineRow>(
      `${LINE_SELECT} where sol.id = any($1::uuid[]) and sol.is_active
       order by sol.created_at, sol.id`,
      [ids],
    );
    return result.rows.map(mapLine);
  }

  async findLinesByOrderId(orderId: string): Promise<SalesOrderLineEntity[]> {
    const result = await this.db.query<LineRow>(
      `${LINE_SELECT} where sol.sales_order_id = $1 and sol.is_active
       order by sol.created_at, sol.id`,
      [orderId],
    );
    return result.rows.map(mapLine);
  }

  async findOrderIdsByLineIds(lineIds: string[]): Promise<string[]> {
    if (lineIds.length === 0) {
      return [];
    }
    const result = await this.db.query<{ sales_order_id: string }>(
      `select distinct sales_order_id from sales_order_lines
       where id = any($1::uuid[]) and is_active`,
      [lineIds],
    );
    return result.rows.map((row) => row.sales_order_id);
  }

  async cancel(id: string, actorId?: string): Promise<void> {
    await this.db.query(
      `update sales_order_lines set line_status = '取消', updated_by = $2
       where sales_order_id = $1 and is_active`,
      [id, actorId ?? null],
    );
    await this.db.query(
      `update sales_orders set status = '取消', updated_by = $2 where id = $1`,
      [id, actorId ?? null],
    );
  }

  async countByOrderDate(date: string): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      `select count(*) as count from sales_orders where order_date = $1 and is_active`,
      [date],
    );
    return toNumber(result.rows[0]?.count);
  }

  async countByStatus(status: string): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      `select count(*) as count from sales_orders where status = $1 and is_active`,
      [status],
    );
    return toNumber(result.rows[0]?.count);
  }
}
