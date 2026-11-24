import { NotFoundError, ValidationError } from '../domain/errors/domain.error';
import { deriveSalesOrderStatus } from '../domain/entities/status-mapper';
import type { RepositoryContext } from '../domain/repositories/unit-of-work.interface';

export function ensureFound<T>(value: T | null | undefined, entity: string, id: string): T {
  if (value === null || value === undefined) {
    throw new NotFoundError(entity, id);
  }
  return value;
}

export function ensurePositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ValidationError(`${label}は1以上の整数である必要があります`, { value });
  }
}

export function ensureNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new ValidationError(`${label}は0以上の整数である必要があります`, { value });
  }
}

/** 明細状態から親受注の状態を再計算して保存する。 */
export async function syncSalesOrderStatus(
  repos: RepositoryContext,
  salesOrderId: string,
  actorId?: string,
): Promise<string> {
  const lines = await repos.salesOrders.findLinesByOrderId(salesOrderId);
  const status = deriveSalesOrderStatus(lines.map((line) => line.lineStatus));
  await repos.salesOrders.updateStatus(salesOrderId, status, actorId);
  return status;
}
