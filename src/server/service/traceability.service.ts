import { ValidationError } from '../domain/errors/domain.error';
import type { TraceabilityRowEntity } from '../domain/entities/lot.entity';
import type { IUnitOfWork } from '../domain/repositories/unit-of-work.interface';

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
