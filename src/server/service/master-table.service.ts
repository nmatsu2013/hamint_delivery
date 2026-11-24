import {
  InternalError,
  NotFoundError,
  TableNotFoundError,
  ValidationError,
} from '../domain/errors/domain.error.js';
import type { Actor } from '../domain/entities/actor.entity.js';
import {
  findMasterTableDefinition,
  listMasterTableSummaries,
} from '../domain/entities/master-table.definitions.js';
import type {
  MasterTableRowsResult,
  MasterTableSummary,
  MasterTableUpdateResult,
} from '../domain/entities/master-table.entity.js';
import type { MasterTableRowsPage } from '../domain/repositories/master-table.repository.interface.js';
import type { IUnitOfWork } from '../domain/repositories/unit-of-work.interface.js';

export interface MasterRowsQueryInput {
  q?: string;
  isActive?: boolean;
  sort?: string;
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

const ALLOWED_PAGE_SIZES = [25, 50, 100];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class MasterTableService {
  constructor(private readonly uow: IUnitOfWork) {}

  listTables(): MasterTableSummary[] {
    return listMasterTableSummaries();
  }

  async listRows(
    tableName: string,
    input: MasterRowsQueryInput,
  ): Promise<MasterTableRowsResult> {
    const definition = findMasterTableDefinition(tableName);
    if (!definition) {
      throw new TableNotFoundError(tableName);
    }

    if (input.q && input.q.length > 100) {
      throw new ValidationError('検索文字列は100文字以内で指定してください');
    }
    const limit = input.limit ?? 50;
    if (!ALLOWED_PAGE_SIZES.includes(limit)) {
      throw new ValidationError('limitは25、50、100のいずれかを指定してください');
    }
    const offset = input.offset ?? 0;
    if (!Number.isInteger(offset) || offset < 0) {
      throw new ValidationError('offsetは0以上の整数で指定してください');
    }
    if (input.isActive !== undefined && !definition.hasActiveFlag) {
      throw new ValidationError('このテーブルは有効状態で絞り込めません');
    }

    const sort = input.sort ?? definition.defaultSort;
    const sortColumn = definition.columns.find(
      (column) => column.name === sort && column.sortable,
    );
    if (!sortColumn) {
      throw new ValidationError(`並び替えできないカラムです: ${sort}`);
    }
    const order = input.order ?? definition.defaultOrder;
    if (order !== 'asc' && order !== 'desc') {
      throw new ValidationError('orderはascまたはdescを指定してください');
    }

    let page: MasterTableRowsPage;
    try {
      page = await this.uow.repos.masterTables.listRows(definition, {
        q: input.q?.trim() || undefined,
        isActive: input.isActive,
        sort,
        order,
        limit,
        offset,
      });
    } catch (error) {
      console.error(`[master-table] query failed: ${definition.name}`, error);
      throw new InternalError('データの取得に失敗しました');
    }

    return {
      table: {
        name: definition.name,
        label: definition.label,
        description: definition.description,
      },
      columns: definition.columns.map((column) => ({
        name: column.name,
        label: column.label,
        dataType: column.dataType,
        sortable: column.sortable,
        visible: column.visible,
        editable: column.editable,
        required: column.required,
        foreignKeyTarget: column.foreignKeyTarget,
      })),
      items: page.items,
      total: page.total,
      limit,
      offset,
    };
  }

  async updateRow(
    tableName: string,
    id: string,
    values: Record<string, unknown>,
    actor: Actor,
  ): Promise<MasterTableUpdateResult> {
    const definition = findMasterTableDefinition(tableName);
    if (!definition || definition.category !== 'master') {
      throw new TableNotFoundError(tableName);
    }
    const entries = Object.entries(values);
    if (entries.length === 0) {
      throw new ValidationError('更新する項目を指定してください');
    }

    const normalized: Record<string, unknown> = {};
    for (const [name, value] of entries) {
      const column = definition.columns.find((candidate) => candidate.name === name);
      if (!column?.editable) {
        throw new ValidationError(`更新できない項目です: ${name}`);
      }
      normalized[name] = normalizeUpdateValue(column, value);
    }

    try {
      const item = await this.uow.run(
        (repos) => repos.masterTables.updateRow(definition, id, normalized),
        actor,
      );
      if (!item) {
        throw new NotFoundError(definition.label, id);
      }
      return { item };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      const code = pgErrorCode(error);
      if (code === '23505' || code === '23P01') {
        throw new ValidationError('同じコードまたは適用期間のデータが既に存在します');
      }
      if (code === '23503') {
        throw new ValidationError('指定した参照先のデータが存在しません');
      }
      if (code === '23502' || code === '23514' || code === '22007' || code === '22P02') {
        throw new ValidationError('入力値がデータベースの制約を満たしていません');
      }
      console.error(`[master-table] update failed: ${definition.name}`, error);
      throw new InternalError('マスタの更新に失敗しました');
    }
  }
}

function normalizeUpdateValue(
  column: {
    name: string;
    label: string;
    dataType: string;
    required: boolean;
  },
  value: unknown,
): unknown {
  const empty = value === null || value === undefined || value === '';
  if (empty) {
    if (column.required) {
      throw new ValidationError(`${column.label}は必須です`);
    }
    return null;
  }
  switch (column.dataType) {
    case 'boolean':
      if (typeof value !== 'boolean') {
        throw new ValidationError(`${column.label}は真偽値で指定してください`);
      }
      return value;
    case 'integer': {
      const number = typeof value === 'number' ? value : Number(value);
      if (!Number.isInteger(number)) {
        throw new ValidationError(`${column.label}は整数で指定してください`);
      }
      return number;
    }
    case 'numeric': {
      const number = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(number)) {
        throw new ValidationError(`${column.label}は数値で指定してください`);
      }
      return number;
    }
    case 'uuid':
      if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
        throw new ValidationError(`${column.label}のIDが不正です`);
      }
      return value;
    case 'date':
      if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
        throw new ValidationError(`${column.label}はYYYY-MM-DD形式で指定してください`);
      }
      return value;
    case 'text':
      if (typeof value !== 'string') {
        throw new ValidationError(`${column.label}は文字列で指定してください`);
      }
      return value.trim();
    default:
      throw new ValidationError(`${column.label}は更新できません`);
  }
}

function pgErrorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code ?? '')
    : undefined;
}
