import type {
  PurchaseOrderEntity,
  PurchaseOrderLineEntity,
  PurchaseOrderSummaryEntity,
} from '../domain/entities/purchase-order.entity';
import { normalizePurchaseOrderStatus } from '../domain/entities/status-mapper';
import type { PurchaseOrderStatus } from '../domain/entities/status';
import type {
  IPurchaseOrderRepository,
  PurchaseOrderListParams,
  ReceiveUpdateData,
} from '../domain/repositories/purchase-order.repository.interface';
import { toNullableNumber, toNullableString, toNumber, type Queryable } from './database';

interface PoRow {
  id: string;
  po_no: string;
  supplier_id: string;
  supplier_name?: string;
  ordered_date: string;
  promised_date: string | null;
  currency: string;
  total_amount: string;
  status: string;
  note: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface PoLineRow {
  id: string;
  purchase_order_id: string;
  product_id: string;
  product_code?: string;
  product_name?: string;
  model_no?: string;
  quantity: number;
  unit_cost: string;
  currency: string;
  sales_order_line_id: string | null;
  applied_hs_code: string | null;
  duty_rate: string | null;
  duty_amount: string | null;
  duty_currency: string;
  received_date: string | null;
  inspector_id: string | null;
  good_qty: number | null;
  defect_qty: number | null;
  damaged_qty: number | null;
  claim_status: string | null;
  claim_note: string | null;
  is_active: boolean;
}

function mapPoLine(row: PoLineRow): PurchaseOrderLineEntity {
  return {
    id: row.id,
    purchaseOrderId: row.purchase_order_id,
    productId: row.product_id,
    productCode: row.product_code,
    productName: row.product_name,
    modelNo: row.model_no,
    quantity: row.quantity,
    unitCost: toNumber(row.unit_cost),
    currency: row.currency,
    salesOrderLineId: row.sales_order_line_id,
    appliedHsCode: row.applied_hs_code,
    dutyRate: toNullableNumber(row.duty_rate),
    dutyAmount: toNullableNumber(row.duty_amount),
    dutyCurrency: row.duty_currency,
    receivedDate: row.received_date,
    inspectorId: row.inspector_id,
    goodQty: row.good_qty,
    defectQty: row.defect_qty,
    damagedQty: row.damaged_qty,
    claimStatus: row.claim_status,
    claimNote: row.claim_note,
    isActive: row.is_active,
  };
}

const PO_LINE_SELECT = `
  select pol.*, p.product_code, p.product_name, p.model_no
  from purchase_order_lines pol
  join products p on p.id = pol.product_id
`;

export class PgPurchaseOrderRepository implements IPurchaseOrderRepository {
  constructor(private readonly db: Queryable) {}

  async findById(id: string): Promise<PurchaseOrderEntity | null> {
    const result = await this.db.query<PoRow>(
      `select po.*, s.supplier_name
       from purchase_orders po
       join suppliers s on s.id = po.supplier_id
       where po.id = $1 and po.is_active`,
      [id],
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return this.mapWithLines(row);
  }

  async findByPoNo(poNo: string): Promise<PurchaseOrderEntity | null> {
    const result = await this.db.query<{ id: string }>(
      `select id from purchase_orders where po_no = $1 and is_active`,
      [poNo],
    );
    const id = result.rows[0]?.id;
    return id ? this.findById(id) : null;
  }

  async findByOrderLineId(salesOrderLineId: string): Promise<PurchaseOrderEntity | null> {
    const result = await this.db.query<{ purchase_order_id: string }>(
      `select purchase_order_id from purchase_order_lines
       where sales_order_line_id = $1 and is_active limit 1`,
      [salesOrderLineId],
    );
    const id = result.rows[0]?.purchase_order_id;
    return id ? this.findById(id) : null;
  }

  async findLineById(purchaseOrderLineId: string): Promise<PurchaseOrderLineEntity | null> {
    const result = await this.db.query<PoLineRow>(
      `${PO_LINE_SELECT} where pol.id = $1 and pol.is_active`,
      [purchaseOrderLineId],
    );
    const row = result.rows[0];
    return row ? mapPoLine(row) : null;
  }

  async findLinesByOrderId(purchaseOrderId: string): Promise<PurchaseOrderLineEntity[]> {
    const result = await this.db.query<PoLineRow>(
      `${PO_LINE_SELECT} where pol.purchase_order_id = $1 and pol.is_active
       order by pol.created_at, pol.id`,
      [purchaseOrderId],
    );
    return result.rows.map(mapPoLine);
  }

  private async mapWithLines(row: PoRow): Promise<PurchaseOrderEntity> {
    const lines = await this.findLinesByOrderId(row.id);
    return {
      id: row.id,
      poNo: row.po_no,
      supplierId: row.supplier_id,
      supplierName: row.supplier_name,
      orderedDate: row.ordered_date,
      promisedDate: row.promised_date,
      currency: row.currency,
      totalAmount: toNumber(row.total_amount),
      status: normalizePurchaseOrderStatus(row.status),
      note: row.note,
      isActive: row.is_active,
      lines,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async generatePoNo(date: Date): Promise<string> {
    const ymd = date.toISOString().slice(2, 10).replace(/-/g, '');
    const prefix = `po${ymd}-`;
    await this.db.query(`select pg_advisory_xact_lock(hashtext($1))`, [prefix]);
    const result = await this.db.query<{ next: string }>(
      `select coalesce(max(substring(po_no from '[0-9]+$')::int), 0) + 1 as next
       from purchase_orders where po_no like $1`,
      [`${prefix}%`],
    );
    return `${prefix}${String(toNumber(result.rows[0]?.next, 1)).padStart(2, '0')}`;
  }

  async save(po: PurchaseOrderEntity): Promise<void> {
    await this.db.query(
      `insert into purchase_orders
        (id, po_no, supplier_id, ordered_date, promised_date, currency, total_amount, status, note, is_active)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)`,
      [
        po.id,
        po.poNo,
        po.supplierId,
        po.orderedDate,
        po.promisedDate,
        po.currency,
        po.totalAmount,
        po.status,
        po.note,
      ],
    );
    for (const line of po.lines) {
      await this.db.query(
        `insert into purchase_order_lines
          (id, purchase_order_id, product_id, quantity, unit_cost, currency,
           sales_order_line_id, applied_hs_code, duty_rate, duty_amount, duty_currency, is_active)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true)`,
        [
          line.id,
          po.id,
          line.productId,
          line.quantity,
          line.unitCost,
          line.currency,
          line.salesOrderLineId,
          line.appliedHsCode,
          line.dutyRate,
          line.dutyAmount,
          line.dutyCurrency,
        ],
      );
    }
  }

  async updateStatus(id: string, status: string, actorId?: string): Promise<void> {
    await this.db.query(
      `update purchase_orders set status = $2, updated_by = $3 where id = $1`,
      [id, status, actorId ?? null],
    );
  }

  async updateReceived(orderLineId: string, data: ReceiveUpdateData): Promise<void> {
    await this.db.query(
      `update purchase_order_lines set
         received_date = $2,
         good_qty = $3,
         defect_qty = $4,
         damaged_qty = $5,
         inspector_id = $6,
         claim_status = $7,
         claim_note = $8,
         updated_by = $6
       where id = $1`,
      [
        orderLineId,
        data.receivedDate,
        data.goodQty,
        data.defectQty,
        data.damagedQty,
        data.inspectorId,
        data.claimStatus ?? (data.defectQty + data.damagedQty > 0 ? 'メーカーへ連絡' : 'なし'),
        data.claimNote ?? null,
      ],
    );
  }

  async list(
    params: PurchaseOrderListParams,
  ): Promise<{ items: PurchaseOrderSummaryEntity[]; total: number }> {
    const values: unknown[] = [];
    const conditions: string[] = ['po.is_active'];
    if (params.status) {
      values.push(params.status);
      conditions.push(`po.status = $${values.length}`);
    }
    values.push(params.limit, params.offset);
    const limitIndex = values.length - 1;
    const offsetIndex = values.length;

    const result = await this.db.query<
      PoRow & {
        line_count: string;
        total_quantity: string | null;
        total_count: string;
      }
    >(
      `select po.*, s.supplier_name,
              coalesce(l.line_count, 0) as line_count,
              coalesce(l.total_quantity, 0) as total_quantity,
              count(*) over() as total_count
       from purchase_orders po
       join suppliers s on s.id = po.supplier_id
       left join lateral (
         select count(*) as line_count, sum(pol.quantity) as total_quantity
         from purchase_order_lines pol
         where pol.purchase_order_id = po.id and pol.is_active
       ) l on true
       where ${conditions.join(' and ')}
       order by po.ordered_date desc, po.po_no desc
       limit $${limitIndex} offset $${offsetIndex}`,
      values,
    );

    const items = result.rows.map((row) => ({
      id: row.id,
      poNo: row.po_no,
      supplierName: row.supplier_name ?? '',
      orderedDate: row.ordered_date,
      promisedDate: row.promised_date,
      currency: row.currency,
      totalAmount: toNumber(row.total_amount),
      status: normalizePurchaseOrderStatus(row.status) as PurchaseOrderStatus,
      lineCount: toNumber(row.line_count),
      totalQuantity: toNumber(row.total_quantity),
    }));
    return { items, total: toNumber(result.rows[0]?.total_count) };
  }
}
