import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShipmentService } from '../../src/server/service/shipment.service';
import { BusinessRuleViolationError } from '../../src/server/domain/errors/domain.error';
import type { Actor } from '../../src/server/domain/entities/actor.entity';
import type {
  SalesOrderEntity,
  SalesOrderLineEntity,
} from '../../src/server/domain/entities/sales-order.entity';
import type { LotEntity } from '../../src/server/domain/entities/lot.entity';
import type {
  CreateDomesticShipmentInput,
  ShipmentEntity,
} from '../../src/server/domain/entities/shipment.entity';
import type {
  IUnitOfWork,
  RepositoryContext,
} from '../../src/server/domain/repositories/unit-of-work.interface';

const actor: Actor = {
  id: '33333333-3333-4333-8333-333333333333',
  userId: 'hamint_user',
};

function makeLine(overrides: Partial<SalesOrderLineEntity> = {}): SalesOrderLineEntity {
  return {
    id: 'line-1',
    salesOrderId: 'order-1',
    productId: 'product-1',
    productName: 'Fiora thread',
    productCode: 'P001',
    quantity: 5,
    unitPrice: 100,
    currency: 'JPY',
    lineStatus: '入荷済',
    shippedQuantity: 0,
    isActive: true,
    ...overrides,
  };
}

function makeOrder(lines: SalesOrderLineEntity[]): SalesOrderEntity {
  return {
    id: 'order-1',
    orderNo: 'so261124-01',
    orderDate: '2026-11-24',
    customerId: 'customer-1',
    shipToId: 'ship-to-1',
    requestedDate: null,
    status: '入荷済',
    totalAmount: 500,
    currency: 'JPY',
    note: null,
    isActive: true,
    lines,
    createdAt: '2026-11-24T00:00:00Z',
    updatedAt: '2026-11-24T00:00:00Z',
  };
}

function makeLot(overrides: Partial<LotEntity> = {}): LotEntity {
  return {
    id: 'lot-1',
    productId: 'product-1',
    lotNo: 'LOT-1',
    expiryDate: '2029-12-31',
    manufacturedDate: null,
    purchaseOrderLineId: 'po-line-1',
    receivedQty: 10,
    onHandQty: 10,
    status: '使用可',
    isActive: true,
    ...overrides,
  };
}

function makeShipment(): ShipmentEntity {
  return {
    id: 'shipment-1',
    shipmentNo: 'sh261124-99',
    direction: 'domestic',
    salesOrderId: 'order-1',
    shipToId: 'ship-to-1',
    purchaseOrderId: null,
    shippedDate: '2026-11-25',
    carrier: 'ヤマト運輸',
    trackingNo: 'TRK-1',
    deliveredDate: null,
    status: '発送済',
    transportMode: null,
    blAwbNo: null,
    etd: null,
    eta: null,
    isActive: true,
    lines: [],
    createdAt: '2026-11-25T00:00:00Z',
    updatedAt: '2026-11-25T00:00:00Z',
  };
}

const input: CreateDomesticShipmentInput = {
  salesOrderId: 'order-1',
  carrier: 'ヤマト運輸',
  trackingNo: 'TRK-1',
  shippedDate: '2026-11-25',
  lines: [{ salesOrderLineId: 'line-1', lotId: 'lot-1', quantity: 5 }],
};

function makeService(options: {
  lot?: LotEntity;
  fifo?: LotEntity[];
  existing?: ShipmentEntity | null;
  shippedQty?: number;
  line?: SalesOrderLineEntity;
} = {}) {
  const lines = [options.line ?? makeLine()];
  const order = makeOrder(lines);
  const lot = options.lot ?? makeLot();
  let shippedQty = options.shippedQty ?? 0;

  const shipments = {
    findBySalesOrderAndTracking: vi.fn().mockResolvedValue(options.existing ?? null),
    getShippedQuantityByLine: vi.fn(async () => shippedQty),
    generateShipmentNo: vi.fn().mockResolvedValue('sh261124-99'),
    save: vi.fn(async (_shipment: ShipmentEntity, shipmentLines: Array<{ quantity: number }>) => {
      shippedQty += shipmentLines.reduce((total, line) => total + line.quantity, 0);
    }),
    findById: vi.fn().mockResolvedValue(makeShipment()),
  };
  const lots = {
    findById: vi.fn().mockResolvedValue(lot),
    findAvailableLotsByProductFIFO: vi.fn().mockResolvedValue(options.fifo ?? [lot]),
    updateOnHandQty: vi.fn().mockResolvedValue(undefined),
    createMovement: vi.fn().mockResolvedValue(undefined),
  };
  const salesOrders = {
    findById: vi.fn().mockResolvedValue(order),
    findLinesByOrderId: vi.fn(async () => lines),
    updateLineStatus: vi.fn(async (id: string, status: string) => {
      const line = lines.find((entry) => entry.id === id);
      if (line) {
        line.lineStatus = status as SalesOrderLineEntity['lineStatus'];
      }
    }),
    updateStatus: vi.fn().mockResolvedValue(undefined),
  };

  const repos = { shipments, lots, salesOrders } as unknown as RepositoryContext;
  const uow: IUnitOfWork = {
    repos,
    run: async (work) => work(repos),
  };
  return { service: new ShipmentService(uow), shipments, lots, salesOrders };
}

describe('ShipmentService.shipDomesticOrder (UC-06)', () => {
  beforeEach(() => {
    process.env.BUSINESS_DATE = '2026-11-24';
  });

  it('正常出荷でロットを減算し、明細・親受注を出荷済にする', async () => {
    const { service, shipments, lots, salesOrders } = makeService();
    const result = await service.shipDomesticOrder(input, actor);

    expect(result.alreadyProcessed).toBe(false);
    expect(result.shipment.shipmentNo).toBe('sh261124-99');
    expect(lots.updateOnHandQty).toHaveBeenCalledWith('lot-1', -5);
    expect(lots.createMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        movementType: 'shipment',
        quantity: 5,
        sourceType: 'shipment_line',
      }),
    );
    expect(salesOrders.updateLineStatus).toHaveBeenCalledWith('line-1', '出荷済', actor.id);
    expect(salesOrders.updateStatus).toHaveBeenCalledWith('order-1', '出荷済', actor.id);
    expect(shipments.save).toHaveBeenCalledTimes(1);
  });

  it('AT-21: 同じ追跡番号の再送は処理済みとして返し、在庫を減らさない', async () => {
    const { service, lots, shipments } = makeService({ existing: makeShipment() });
    const result = await service.shipDomesticOrder(input, actor);
    expect(result.alreadyProcessed).toBe(true);
    expect(result.shipment.shipmentNo).toBe('sh261124-99');
    expect(lots.updateOnHandQty).not.toHaveBeenCalled();
    expect(shipments.save).not.toHaveBeenCalled();
  });

  it('AT-22: 受注数量を超える出荷は拒否する', async () => {
    const { service, lots } = makeService();
    await expect(
      service.shipDomesticOrder(
        { ...input, lines: [{ ...input.lines[0]!, quantity: 6 }] },
        actor,
      ),
    ).rejects.toThrow(BusinessRuleViolationError);
    expect(lots.updateOnHandQty).not.toHaveBeenCalled();
  });

  it('AT-23: 使用期限切れのロットは拒否する', async () => {
    const { service, lots } = makeService({ lot: makeLot({ expiryDate: '2020-01-01' }) });
    await expect(service.shipDomesticOrder(input, actor)).rejects.toThrow('使用期限切れ');
    expect(lots.updateOnHandQty).not.toHaveBeenCalled();
  });

  it('先入先出: 期限の早い別ロットがある場合は理由がないと拒否する', async () => {
    const earlier = makeLot({ id: 'lot-0', lotNo: 'LOT-0', expiryDate: '2027-01-01' });
    const { service } = makeService({ fifo: [earlier, makeLot()] });
    await expect(service.shipDomesticOrder(input, actor)).rejects.toThrow('先入先出');
  });

  it('先入先出: 理由があれば別ロットで出荷できる', async () => {
    const earlier = makeLot({ id: 'lot-0', lotNo: 'LOT-0', expiryDate: '2027-01-01' });
    const { service } = makeService({ fifo: [earlier, makeLot()] });
    const result = await service.shipDomesticOrder(
      { ...input, fifoOverrideReason: '指定ロットの使用指示' },
      actor,
    );
    expect(result.alreadyProcessed).toBe(false);
  });

  it('在庫不足のロットは拒否する', async () => {
    const { service } = makeService({ lot: makeLot({ onHandQty: 1 }) });
    await expect(service.shipDomesticOrder(input, actor)).rejects.toThrow('在庫が不足');
  });

  it('使用可以外のロットは拒否する', async () => {
    const { service } = makeService({ lot: makeLot({ status: '保留' }) });
    await expect(service.shipDomesticOrder(input, actor)).rejects.toThrow('「使用可」ではない');
  });
});
