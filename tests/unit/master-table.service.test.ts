import { describe, expect, it, vi } from 'vitest';
import { MasterTableService } from '../../src/server/service/master-table.service.js';
import { TableNotFoundError, ValidationError } from '../../src/server/domain/errors/domain.error.js';
import { MASTER_TABLE_DEFINITIONS } from '../../src/server/domain/entities/master-table.definitions.js';
import type {
  IUnitOfWork,
  RepositoryContext,
} from '../../src/server/domain/repositories/unit-of-work.interface.js';

function makeService() {
  const listRows = vi.fn().mockResolvedValue({
    items: [
      {
        id: '00000000-0000-0000-0000-000000000001',
        values: { customer_code: 'C001', clinic_name: 'さくら美容クリニック' },
        displayValues: {},
      },
    ],
    total: 8,
  });
  const updateRow = vi.fn().mockResolvedValue({
    id: '00000000-0000-0000-0000-000000000001',
    values: { customer_code: 'C001', clinic_name: '更新後クリニック' },
    displayValues: {},
  });
  const repos = { masterTables: { listRows, updateRow } } as unknown as RepositoryContext;
  const uow: IUnitOfWork = {
    repos,
    run: async (work) => work(repos),
  };
  return { service: new MasterTableService(uow), listRows, updateRow };
}

describe('MasterTableService', () => {
  it('22テーブルのメタデータを返す', () => {
    const { service } = makeService();
    const tables = service.listTables();
    expect(tables).toHaveLength(22);
    expect(tables.filter((table) => table.category === 'master')).toHaveLength(8);
    expect(tables.filter((table) => table.category === 'transaction')).toHaveLength(13);
    expect(tables.filter((table) => table.category === 'audit')).toHaveLength(1);
  });

  it('許可リスト外のテーブルはTableNotFoundError', async () => {
    const { service } = makeService();
    await expect(service.listRows('users', {})).rejects.toMatchObject({
      code: 'TABLE_NOT_FOUND',
    });
    await expect(service.listRows('customers;drop', {})).rejects.toBeInstanceOf(
      TableNotFoundError,
    );
  });

  it('既定の並び順・件数でリポジトリを呼ぶ', async () => {
    const { service, listRows } = makeService();
    const result = await service.listRows('customers', {});
    expect(listRows).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'customers' }),
      {
        q: undefined,
        isActive: undefined,
        sort: 'customer_code',
        order: 'asc',
        limit: 50,
        offset: 0,
      },
    );
    expect(result.total).toBe(8);
    expect(result.columns.find((column) => column.name === 'id')?.visible).toBe(false);
  });

  it('ソート・検索・ページングを受け付ける', async () => {
    const { service, listRows } = makeService();
    await service.listRows('customers', {
      q: ' さくら ',
      isActive: true,
      sort: 'clinic_name',
      order: 'desc',
      limit: 100,
      offset: 50,
    });
    expect(listRows).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'customers' }),
      {
        q: 'さくら',
        isActive: true,
        sort: 'clinic_name',
        order: 'desc',
        limit: 100,
        offset: 50,
      },
    );
  });

  it('不正なlimit・offset・sortはValidationError', async () => {
    const { service } = makeService();
    await expect(service.listRows('customers', { limit: 10 })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(service.listRows('customers', { offset: -1 })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(
      service.listRows('customers', { q: 'a'.repeat(101) }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      service.listRows('customers', { sort: 'address;drop', order: 'asc' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('is_activeを持たないaudit_logsでは有効状態絞り込みを拒否する', async () => {
    const { service } = makeService();
    await expect(service.listRows('audit_logs', { isActive: true })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('DBエラーはSQL詳細を漏らさないInternalErrorに変換する', async () => {
    const listRows = vi.fn().mockRejectedValue(new Error('select * from secret_table'));
    const repos = { masterTables: { listRows } } as unknown as RepositoryContext;
    const uow: IUnitOfWork = {
      repos,
      run: async (work) => work(repos),
    };
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const service = new MasterTableService(uow);
      await expect(service.listRows('customers', {})).rejects.toMatchObject({
        code: 'INTERNAL_ERROR',
        message: 'データの取得に失敗しました',
      });
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('マスタの編集可能項目を正規化してトランザクション更新する', async () => {
    const { service, updateRow } = makeService();
    const actor = {
      id: '55555555-5555-4555-8555-555555555555',
      userId: 'hamint_user',
    };
    const result = await service.updateRow(
      'customers',
      '00000000-0000-0000-0000-000000000001',
      { clinic_name: ' 更新後クリニック ', closing_day: '20', is_active: true },
      actor,
    );
    expect(updateRow).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'customers' }),
      '00000000-0000-0000-0000-000000000001',
      { clinic_name: '更新後クリニック', closing_day: 20, is_active: true },
    );
    expect(result.item.values.clinic_name).toBe('更新後クリニック');
  });

  it('業務テーブル・システム項目・不正な値は更新できない', async () => {
    const { service } = makeService();
    const actor = {
      id: '55555555-5555-4555-8555-555555555555',
      userId: 'hamint_user',
    };
    await expect(
      service.updateRow(
        'sales_orders',
        '00000000-0000-0000-0000-000000000001',
        { status: 'completed' },
        actor,
      ),
    ).rejects.toBeInstanceOf(TableNotFoundError);
    await expect(
      service.updateRow(
        'customers',
        '00000000-0000-0000-0000-000000000001',
        { id: '00000000-0000-0000-0000-000000000002' },
        actor,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      service.updateRow(
        'customers',
        '00000000-0000-0000-0000-000000000001',
        { closing_day: 'abc' },
        actor,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('Master table definitions', () => {
  it('テーブル名・カラム名が一意で、既定ソートが存在する', () => {
    const names = MASTER_TABLE_DEFINITIONS.map((definition) => definition.name);
    expect(new Set(names).size).toBe(names.length);
    for (const definition of MASTER_TABLE_DEFINITIONS) {
      const columns = definition.columns.map((column) => column.name);
      expect(new Set(columns).size).toBe(columns.length);
      expect(columns).toContain(definition.defaultSort);
      if (definition.defaultSecondarySort) {
        expect(columns).toContain(definition.defaultSecondarySort);
      }
    }
  });

  it('外部キーの参照先が許可テーブルに含まれる', () => {
    const names = new Set(MASTER_TABLE_DEFINITIONS.map((definition) => definition.name));
    for (const definition of MASTER_TABLE_DEFINITIONS) {
      for (const foreignKey of definition.foreignKeys) {
        expect(names.has(foreignKey.target)).toBe(true);
        expect(definition.columns.map((column) => column.name)).toContain(
          foreignKey.column,
        );
      }
    }
  });
});
