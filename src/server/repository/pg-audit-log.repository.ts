import type { AuditLogEntity } from '../domain/entities/audit-log.entity';
import type {
  AuditLogListParams,
  IAuditLogRepository,
} from '../domain/repositories/audit-log.repository.interface';
import { toNumber, type Queryable } from './database';

interface AuditLogRow {
  id: string;
  table_name: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  user_id: string | null;
  user_role: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}

export class PgAuditLogRepository implements IAuditLogRepository {
  constructor(private readonly db: Queryable) {}

  async list(
    params: AuditLogListParams,
  ): Promise<{ items: AuditLogEntity[]; total: number }> {
    const values: unknown[] = [];
    const conditions: string[] = ['true'];
    if (params.tableName) {
      values.push(params.tableName);
      conditions.push(`table_name = $${values.length}`);
    }
    if (params.recordId) {
      values.push(params.recordId);
      conditions.push(`record_id = $${values.length}`);
    }
    values.push(params.limit, params.offset);
    const limitIndex = values.length - 1;
    const offsetIndex = values.length;

    const result = await this.db.query<AuditLogRow & { total_count: string }>(
      `select *, count(*) over() as total_count
       from audit_logs
       where ${conditions.join(' and ')}
       order by created_at desc
       limit $${limitIndex} offset $${offsetIndex}`,
      values,
    );

    const items = result.rows.map((row) => ({
      id: row.id,
      tableName: row.table_name,
      recordId: row.record_id,
      action: row.action,
      userId: row.user_id,
      userRole: row.user_role,
      oldData: row.old_data,
      newData: row.new_data,
      createdAt: row.created_at,
    }));
    return { items, total: toNumber(result.rows[0]?.total_count) };
  }
}
