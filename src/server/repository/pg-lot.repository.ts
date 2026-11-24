import { BusinessRuleViolationError } from '../domain/errors/domain.error.js';
import type {
  LotEntity,
  LotMovementEntity,
  TraceabilityRowEntity,
} from '../domain/entities/lot.entity.js';
import { normalizeLotStatus } from '../domain/entities/status-mapper.js';
import type { ILotRepository } from '../domain/repositories/lot.repository.interface.js';
import { toNumber, type Queryable } from './database.js';

interface LotRow {
  id: string;
  product_id: string;
  product_code?: string;
  product_name?: string;
  lot_no: string;
  expiry_date: string;
  manufactured_date: string | null;
  purchase_order_line_id: string | null;
  received_qty: number;
  on_hand_qty: number;
  status: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

function mapLot(row: LotRow): LotEntity {
  return {
    id: row.id,
    productId: row.product_id,
    productCode: row.product_code,
    productName: row.product_name,
    lotNo: row.lot_no,
    expiryDate: row.expiry_date,
    manufacturedDate: row.manufactured_date,
    purchaseOrderLineId: row.purchase_order_line_id,
    receivedQty: row.received_qty,
    onHandQty: row.on_hand_qty,
    status: normalizeLotStatus(row.status),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const LOT_SELECT = `
  select l.*, p.product_code, p.product_name
  from lots l
  join products p on p.id = l.product_id
`;

export class PgLotRepository implements ILotRepository {
  constructor(private readonly db: Queryable) {}

  async findById(id: string): Promise<LotEntity | null> {
    const result = await this.db.query<LotRow>(
      `${LOT_SELECT} where l.id = $1 and l.is_active`,
      [id],
    );
    const row = result.rows[0];
    return row ? mapLot(row) : null;
  }

  async findByProductAndLotNo(productId: string, lotNo: string): Promise<LotEntity | null> {
    const result = await this.db.query<LotRow>(
      `${LOT_SELECT} where l.product_id = $1 and l.lot_no = $2 and l.is_active`,
      [productId, lotNo],
    );
    const row = result.rows[0];
    return row ? mapLot(row) : null;
  }

  async findAvailableLotsByProductFIFO(
    productId: string,
    minExpiryDate: string,
  ): Promise<LotEntity[]> {
    const result = await this.db.query<LotRow>(
      `${LOT_SELECT}
       where l.product_id = $1 and l.status = '使用可' and l.is_active
         and l.on_hand_qty > 0 and l.expiry_date >= $2
       order by l.expiry_date asc, l.created_at asc, l.id asc`,
      [productId, minExpiryDate],
    );
    return result.rows.map(mapLot);
  }

  async listAvailable(productId?: string): Promise<LotEntity[]> {
    const values: unknown[] = [];
    const conditions = [`l.status = '使用可'`, 'l.is_active', 'l.on_hand_qty > 0'];
    if (productId) {
      values.push(productId);
      conditions.push(`l.product_id = $${values.length}`);
    }
    const result = await this.db.query<LotRow>(
      `${LOT_SELECT} where ${conditions.join(' and ')}
       order by l.expiry_date asc, l.lot_no asc`,
      values,
    );
    return result.rows.map(mapLot);
  }

  async save(lot: LotEntity): Promise<void> {
    await this.db.query(
      `insert into lots
        (id, product_id, lot_no, expiry_date, manufactured_date, purchase_order_line_id,
         received_qty, on_hand_qty, status, is_active)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)`,
      [
        lot.id,
        lot.productId,
        lot.lotNo,
        lot.expiryDate,
        lot.manufacturedDate,
        lot.purchaseOrderLineId,
        lot.receivedQty,
        lot.onHandQty,
        lot.status,
      ],
    );
  }

  async updateOnHandQty(lotId: string, delta: number): Promise<void> {
    const result = await this.db.query(
      `update lots set on_hand_qty = on_hand_qty + $2
       where id = $1 and on_hand_qty + $2 >= 0`,
      [lotId, delta],
    );
    if (result.rowCount === 0) {
      throw new BusinessRuleViolationError('ロット在庫が不足しています');
    }
  }

  async addReceivedQty(lotId: string, quantity: number): Promise<void> {
    await this.db.query(
      `update lots set received_qty = received_qty + $2, on_hand_qty = on_hand_qty + $2
       where id = $1 and is_active`,
      [lotId, quantity],
    );
  }

  async createMovement(movement: LotMovementEntity): Promise<void> {
    await this.db.query(
      `insert into lot_movements
        (lot_id, movement_type, quantity, source_type, source_id,
         customer_id, ship_to_id, created_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        movement.lotId,
        movement.movementType,
        movement.quantity,
        movement.sourceType,
        movement.sourceId,
        movement.customerId ?? null,
        movement.shipToId ?? null,
        movement.createdBy ?? null,
      ],
    );
  }

  async getTraceability(lotNo: string): Promise<TraceabilityRowEntity[]> {
    const result = await this.db.query<{
      lot_no: string;
      product_name: string;
      customer_name: string;
      ship_to_name: string;
      address: string;
      shipped_date: string;
      quantity: number;
      tracking_no: string;
      carrier: string;
    }>(
      `select l.lot_no, p.product_name,
              c.clinic_name as customer_name,
              ca.ship_to_name, ca.address,
              sh.shipped_date, sl.quantity,
              sh.tracking_no, sh.carrier
       from lot_movements lm
       join lots l on l.id = lm.lot_id
       join products p on p.id = l.product_id
       join shipment_lines sl on sl.id = lm.source_id and lm.source_type = 'shipment_line'
       join shipments sh on sh.id = sl.shipment_id
       left join customers c on c.id = lm.customer_id
       left join customer_addresses ca on ca.id = lm.ship_to_id
       where l.lot_no = $1 and lm.movement_type = 'shipment' and lm.is_active
       order by sh.shipped_date asc, sh.shipment_no asc`,
      [lotNo],
    );
    return result.rows.map((row) => ({
      lotNo: row.lot_no,
      productName: row.product_name,
      customerName: row.customer_name ?? '',
      shipToName: row.ship_to_name ?? '',
      address: row.address ?? '',
      shippedDate: row.shipped_date,
      quantity: toNumber(row.quantity),
      trackingNo: row.tracking_no ?? '',
      carrier: row.carrier ?? '',
    }));
  }
}
