import type { IUnitOfWork } from '../domain/repositories/unit-of-work.interface';
import { clampPageSize, parseOffset } from '../config/constants';

export interface AuditLogListQuery {
  tableName?: string;
  recordId?: string;
  limit?: number;
  offset?: number;
}

export class AuditLogService {
  constructor(private readonly uow: IUnitOfWork) {}

  async list(query: AuditLogListQuery) {
    const limit = clampPageSize(query.limit);
    const offset = parseOffset(query.offset);
    const result = await this.uow.repos.auditLogs.list({
      tableName: query.tableName,
      recordId: query.recordId,
      limit,
      offset,
    });
    return { ...result, limit, offset };
  }
}
