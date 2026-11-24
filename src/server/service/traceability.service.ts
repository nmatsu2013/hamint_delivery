import { ValidationError } from '../domain/errors/domain.error.js';
import type { TraceabilityRowEntity } from '../domain/entities/lot.entity.js';
import type { IUnitOfWork } from '../domain/repositories/unit-of-work.interface.js';

/** UC-08: ロット追跡・回収検索 */
export class TraceabilityService {
  constructor(private readonly uow: IUnitOfWork) {}

  async traceLot(lotNo: string): Promise<TraceabilityRowEntity[]> {
    const normalized = lotNo.trim();
    if (!normalized) {
      throw new ValidationError('ロット番号を指定してください');
    }
    return this.uow.repos.lots.getTraceability(normalized);
  }
}
