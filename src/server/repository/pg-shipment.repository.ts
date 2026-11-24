import type {
  ShipmentEntity,
  ShipmentLineEntity,
  ShipmentSummaryEntity,
} from '../domain/entities/shipment.entity';
import {
  normalizeShipmentDirection,
  normalizeShipmentStatus,
} from '../domain/entities/status-mapper';
import {
  SHIPMENT_DIRECTION_LABEL,
  type ShipmentDirection,
  type ShipmentStatus,
} from '../domain/entities/status';
import type {
  IShipmentRepository,
  ShipmentListParams,
} from '../domain/repositories/shipment.repository.interface';
import { toNumber, type Queryable } from './database';

interface ShipmentRow {
  id: string;
  shipment_no: string;
  direction: string;
  sales_order_id: string | null;
  ship_to_id: string | null;
  purchase_order_id: string | null;
  shipped_date: string | null;
  carrier: string | null;
  tracking_no: string | null;
  delivered_date: string | null;
  status: string;
  transport_mode: string | null;
  bl_awb_no: string | null;
  etd: string | null;
  eta: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ShipmentLineRow {
  id: string;
  shipment_id: string;
  sales_order_line_id: string | null;
  purchase_order_line_id: string | null;
  lot_id: string | null;
  quantity: number;
  lot_no?: string | null;
  product_name?: string | null;
  is_active: boolean;
}

function mapShipmentLine(row: ShipmentLineRow): ShipmentLineEntity {
  return {
    id: row.id,
    shipmentId: row.shipment_id,
    salesOrderLineId: row.sales_order_line_id,
    purchaseOrderLineId: row.purchase_order_line_id,
    lotId: row.lot_id,
    quantity: row.quantity,
    lotNo: row.lot_no ?? undefined,
    productName: row.product_name ?? undefined,
    isActive: row.is_active,
  };
}

export class PgShipmentRepository implements IShipmentRepository {
  constructor(private readonly db: Queryable) {}

  private async findLines(shipmentId: string): Promise<ShipmentLineEntity[]> {
    const result = await this.db.query<ShipmentLineRow>(
      `select sl.*, l.lot_no,
              coalesce(p1.product_name, p2.product_name) as product_name
       from shipment_lines sl
       left join lots l on l.id = sl.lot_id
       left join sales_order_lines sol on sol.id = sl.sales_order_line_id
       left join products p1 on p1.id = sol.product_id
       left join purchase_order_lines pol on pol.id = sl.purchase_order_line_id
       left join products p2 on p2.id = pol.product_id
       where sl.shipment_id = $1 and sl.is_active
       order by sl.created_at, sl.id`,
      [shipmentId],
    );
    return result.rows.map(mapShipmentLine);
  }

  async findById(id: string): Promise<ShipmentEntity | null> {
    const result = await this.db.query<ShipmentRow>(
      `select * from shipments where id = $1 and is_active`,
      [id],
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    const lines = await this.findLines(row.id);
    return {
      id: row.id,
      shipmentNo: row.shipment_no,
      direction: normalizeShipmentDirection(row.direction),
      salesOrderId: row.sales_order_id,
      shipToId: row.ship_to_id,
      purchaseOrderId: row.purchase_order_id,
      shippedDate: row.shipped_date,
      carrier: row.carrier,
      trackingNo: row.tracking_no,
      deliveredDate: row.delivered_date,
      status: normalizeShipmentStatus(row.status),
      transportMode: row.transport_mode,
      blAwbNo: row.bl_awb_no,
      etd: row.etd,
      eta: row.eta,
      isActive: row.is_active,
      lines,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async findByShipmentNo(shipmentNo: string): Promise<ShipmentEntity | null> {
    const result = await this.db.query<{ id: string }>(
      `select id from shipments where shipment_no = $1 and is_active`,
      [shipmentNo],
    );
    const id = result.rows[0]?.id;
    return id ? this.findById(id) : null;
  }

  async save(shipment: ShipmentEntity, lines: ShipmentLineEntity[]): Promise<void> {
    await this.db.query(
      `insert into shipments
        (id, shipment_no, direction, sales_order_id, ship_to_id, purchase_order_id,
         shipped_date, carrier, tracking_no, delivered_date, status, transport_mode,
         bl_awb_no, etd, eta, is_active)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,true)`,
      [
        shipment.id,
        shipment.shipmentNo,
        shipment.direction,
        shipment.salesOrderId,
        shipment.shipToId,
        shipment.purchaseOrderId,
        shipment.shippedDate,
        shipment.carrier,
        shipment.trackingNo,
        shipment.deliveredDate,
        shipment.status,
        shipment.transportMode,
        shipment.blAwbNo,
        shipment.etd,
        shipment.eta,
      ],
    );
    for (const line of lines) {
      await this.db.query(
        `insert into shipment_lines
          (id, shipment_id, sales_order_line_id, purchase_order_line_id, lot_id, quantity, is_active)
         values ($1,$2,$3,$4,$5,$6,true)`,
        [
          line.id,
          shipment.id,
          line.salesOrderLineId,
          line.purchaseOrderLineId,
          line.lotId,
          line.quantity,
        ],
      );
    }
  }

  async findExistingByOrderLine(salesOrderLineId: string): Promise<ShipmentEntity[]> {
    const result = await this.db.query<{ shipment_id: string }>(
      `select distinct sl.shipment_id
       from shipment_lines sl
       join shipments sh on sh.id = sl.shipment_id
       where sl.sales_order_line_id = $1 and sl.is_active and sh.is_active
         and sh.status <> '準備中'`,
      [salesOrderLineId],
    );
    const shipments: ShipmentEntity[] = [];
    for (const row of result.rows) {
      const shipment = await this.findById(row.shipment_id);
      if (shipment) {
        shipments.push(shipment);
      }
    }
    return shipments;
  }

  async findBySalesOrderId(salesOrderId: string): Promise<ShipmentEntity[]> {
    const result = await this.db.query<{ id: string }>(
      `select id from shipments
       where sales_order_id = $1 and is_active
       order by shipped_date asc nulls last, created_at asc`,
      [salesOrderId],
    );
    const shipments: ShipmentEntity[] = [];
    for (const row of result.rows) {
      const shipment = await this.findById(row.id);
      if (shipment) {
        shipments.push(shipment);
      }
    }
    return shipments;
  }

  async findBySalesOrderAndTracking(
    salesOrderId: string,
    trackingNo: string,
  ): Promise<ShipmentEntity | null> {
    const result = await this.db.query<{ id: string }>(
      `select id from shipments
       where sales_order_id = $1 and tracking_no = $2 and direction = 'domestic' and is_active
       order by created_at asc limit 1`,
      [salesOrderId, trackingNo],
    );
    const id = result.rows[0]?.id;
    return id ? this.findById(id) : null;
  }

  async findByPurchaseOrderId(purchaseOrderId: string): Promise<ShipmentEntity | null> {
    const result = await this.db.query<{ id: string }>(
      `select id from shipments
       where purchase_order_id = $1 and direction = 'international' and is_active
       order by created_at asc limit 1`,
      [purchaseOrderId],
    );
    const id = result.rows[0]?.id;
    return id ? this.findById(id) : null;
  }

  async getShippedQuantityByLine(salesOrderLineId: string): Promise<number> {
    const result = await this.db.query<{ quantity: string }>(
      `select coalesce(sum(sl.quantity), 0) as quantity
       from shipment_lines sl
       join shipments sh on sh.id = sl.shipment_id
       where sl.sales_order_line_id = $1 and sl.is_active and sh.is_active`,
      [salesOrderLineId],
    );
    return toNumber(result.rows[0]?.quantity);
  }

  async generateShipmentNo(direction: ShipmentDirection, date: Date): Promise<string> {
    const ymd = date.toISOString().slice(2, 10).replace(/-/g, '');
    const prefix = `${direction === 'international' ? 'in' : 'sh'}${ymd}-`;
    await this.db.query(`select pg_advisory_xact_lock(hashtext($1))`, [prefix]);
    const result = await this.db.query<{ next: string }>(
      `select coalesce(max(substring(shipment_no from '[0-9]+$')::int), 0) + 1 as next
       from shipments where shipment_no like $1`,
      [`${prefix}%`],
    );
    return `${prefix}${String(toNumber(result.rows[0]?.next, 1)).padStart(2, '0')}`;
  }

  async list(
    params: ShipmentListParams,
  ): Promise<{ items: ShipmentSummaryEntity[]; total: number }> {
    const values: unknown[] = [];
    const conditions: string[] = ['sh.is_active'];
    if (params.direction) {
      values.push(params.direction);
      conditions.push(`sh.direction = $${values.length}`);
    }
    values.push(params.limit, params.offset);
    const limitIndex = values.length - 1;
    const offsetIndex = values.length;

    const result = await this.db.query<
      ShipmentRow & {
        order_no: string | null;
        po_no: string | null;
        total_quantity: string | null;
        total_count: string;
      }
    >(
      `select sh.*, so.order_no, po.po_no,
              coalesce(l.total_quantity, 0) as total_quantity,
              count(*) over() as total_count
       from shipments sh
       left join sales_orders so on so.id = sh.sales_order_id
       left join purchase_orders po on po.id = sh.purchase_order_id
       left join lateral (
         select sum(sl.quantity) as total_quantity
         from shipment_lines sl
         where sl.shipment_id = sh.id and sl.is_active
       ) l on true
       where ${conditions.join(' and ')}
       order by sh.shipped_date desc nulls last, sh.shipment_no desc
       limit $${limitIndex} offset $${offsetIndex}`,
      values,
    );

    const items = result.rows.map((row) => {
      const direction = normalizeShipmentDirection(row.direction);
      return {
        id: row.id,
        shipmentNo: row.shipment_no,
        direction,
        directionLabel: SHIPMENT_DIRECTION_LABEL[direction],
        status: normalizeShipmentStatus(row.status) as ShipmentStatus,
        shippedDate: row.shipped_date,
        deliveredDate: row.delivered_date,
        carrier: row.carrier,
        trackingNo: row.tracking_no,
        orderNo: row.order_no ?? undefined,
        poNo: row.po_no ?? undefined,
        totalQuantity: toNumber(row.total_quantity),
      };
    });
    return { items, total: toNumber(result.rows[0]?.total_count) };
  }

  async markDelivered(id: string, deliveredDate: string, actorId?: string): Promise<void> {
    await this.db.query(
      `update shipments set delivered_date = $2, status = '納品済', updated_by = $3
       where id = $1`,
      [id, deliveredDate, actorId ?? null],
    );
  }
}
