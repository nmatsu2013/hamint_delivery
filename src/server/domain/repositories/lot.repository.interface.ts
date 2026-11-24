import type { LotEntity, LotMovementEntity, TraceabilityRowEntity } from '../entities/lot.entity';

export interface ILotRepository {
  findById(id: string): Promise<LotEntity | null>;
  findByProductAndLotNo(productId: string, lotNo: string): Promise<LotEntity | null>;
  findAvailableLotsByProductFIFO(productId: string, minExpiryDate: string): Promise<LotEntity[]>;
  listAvailable(productId?: string): Promise<LotEntity[]>;
  save(lot: LotEntity): Promise<void>;
  /** 符号付きの増減量。出荷時は負数、入荷時は正数。 */
  updateOnHandQty(lotId: string, delta: number): Promise<void>;
  /** 同一ロットへの追加入荷。received_qty と on_hand_qty を同時に加算する。 */
  addReceivedQty(lotId: string, quantity: number): Promise<void>;
  createMovement(movement: LotMovementEntity): Promise<void>;
  getTraceability(lotNo: string): Promise<TraceabilityRowEntity[]>;
}
