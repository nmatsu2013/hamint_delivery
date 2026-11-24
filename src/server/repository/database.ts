import { Pool, types as pgTypes } from 'pg';
import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { createPgConfig } from '../config/pg';

// date / timestamp はタイムゾーン変換をせず文字列のまま扱う（YYYY-MM-DD / ISO 文字列）。
pgTypes.setTypeParser(1082, (value: string) => value);
pgTypes.setTypeParser(1114, (value: string) => value);
pgTypes.setTypeParser(1184, (value: string) => value);

export interface Queryable {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;
}

export class PgDatabase {
  readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      ...createPgConfig(connectionString),
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export function toNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function toStringValue(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) {
    return fallback;
  }
  return String(value);
}

export function toNullableString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return String(value);
}

export type { PoolClient };
