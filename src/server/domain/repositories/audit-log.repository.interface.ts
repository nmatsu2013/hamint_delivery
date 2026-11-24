import type { AuditLogEntity } from '../entities/audit-log.entity.js';

export interface AuditLogListParams {
  tableName?: string;
  recordId?: string;
  limit: number;
  offset: number;
}

export interface IAuditLogRepository {
  list(params: AuditLogListParams): Promise<{ items: AuditLogEntity[]; total: number }>;
}
