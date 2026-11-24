import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../components/elements/PageHeader';
import { ErrorAlert, LoadingState } from '../components/elements/StateViews';
import {
  getMasterRows,
  getMasterTables,
  updateMasterRow,
} from '../features/masterTable/api/masterTableApi';
import { MasterDataGrid } from '../features/masterTable/components/MasterDataGrid';
import { MasterEditDrawer } from '../features/masterTable/components/MasterEditDrawer';
import { MasterRecordDrawer } from '../features/masterTable/components/MasterRecordDrawer';
import { MasterTableTabs } from '../features/masterTable/components/MasterTableTabs';
import { MasterTableToolbar } from '../features/masterTable/components/MasterTableToolbar';
import type { MasterTableRow, MasterTableSummary } from '../features/masterTable/types/masterTable';
import '../styles/master.css';

const PAGE_SIZES = [25, 50, 100];

export function MasterPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const definitionsQuery = useQuery({
    queryKey: ['master-tables'],
    queryFn: getMasterTables,
  });
  const tables = useMemo(
    () => (definitionsQuery.data?.items ?? []).filter((table) => table.category === 'master'),
    [definitionsQuery.data],
  );

  const tableParam = searchParams.get('table');
  const selected = useMemo<MasterTableSummary | null>(() => {
    return (
      tables.find((table) => table.name === tableParam) ??
      tables.find((table) => table.name === 'customers') ??
      tables[0] ??
      null
    );
  }, [tables, tableParam]);

  const pageSizeParam = Number(searchParams.get('pageSize'));
  const pageSize = PAGE_SIZES.includes(pageSizeParam) ? pageSizeParam : 50;
  const pageParam = Number(searchParams.get('page'));
  const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;
  const offset = (page - 1) * pageSize;
  const q = searchParams.get('q') ?? '';
  const isActiveParam = searchParams.get('isActive');
  const isActive = isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : undefined;
  const sort = searchParams.get('sort') ?? undefined;
  const orderParam = searchParams.get('order');
  const order = orderParam === 'asc' || orderParam === 'desc' ? orderParam : undefined;

  const updateParams = useCallback(
    (
      patch: Record<string, string | null>,
      options: { resetPage?: boolean; replace?: boolean } = {},
    ) => {
      const next = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === '') {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      }
      if (options.resetPage !== false) {
        next.set('page', '1');
      }
      setSearchParams(next, { replace: options.replace ?? false });
    },
    [searchParams, setSearchParams],
  );

  useEffect(() => {
    if (!definitionsQuery.data) {
      return;
    }
    if (!tables.some((table) => table.name === tableParam)) {
      const next = new URLSearchParams(searchParams);
      next.set('table', 'customers');
      next.set('page', '1');
      setSearchParams(next, { replace: true });
    }
  }, [definitionsQuery.data, tables, tableParam, searchParams, setSearchParams]);

  const [searchInput, setSearchInput] = useState(q);
  useEffect(() => {
    setSearchInput(q);
  }, [q]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (searchInput.trim() !== q) {
        updateParams({ q: searchInput.trim() || null });
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, q, updateParams]);

  const rowsQuery = useQuery({
    queryKey: [
      'master-rows',
      selected?.name ?? 'none',
      q,
      isActive,
      sort,
      order,
      pageSize,
      offset,
    ],
    queryFn: () =>
      getMasterRows(selected?.name as string, {
        q: q || undefined,
        isActive,
        sort,
        order,
        limit: pageSize,
        offset,
      }),
    enabled: Boolean(selected),
    placeholderData: (previousData) =>
      previousData && previousData.table.name === selected?.name ? previousData : undefined,
  });

  useEffect(() => {
    if (rowsQuery.data && rowsQuery.data.total > 0 && offset >= rowsQuery.data.total) {
      const lastPage = Math.max(1, Math.ceil(rowsQuery.data.total / pageSize));
      updateParams({ page: String(lastPage) }, { resetPage: false, replace: true });
    }
  }, [rowsQuery.data, offset, pageSize, updateParams]);

  const [selectedRow, setSelectedRow] = useState<MasterTableRow | null>(null);
  const [editingRow, setEditingRow] = useState<MasterTableRow | null>(null);
  const [savedMessage, setSavedMessage] = useState('');
  const closeDrawer = useCallback(() => setSelectedRow(null), []);
  const closeEditor = useCallback(() => setEditingRow(null), []);

  const updateMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) => {
      if (!selected || !editingRow) {
        throw new Error('編集対象が選択されていません');
      }
      return updateMasterRow(selected.name, editingRow.id, values);
    },
    onSuccess: async () => {
      closeEditor();
      setSavedMessage('マスタを更新しました');
      await queryClient.invalidateQueries({ queryKey: ['master-rows', selected?.name] });
      window.setTimeout(() => setSavedMessage(''), 3000);
    },
  });

  const changeTable = (tableName: string) => {
    closeDrawer();
    closeEditor();
    setSearchInput('');
    updateParams({ table: tableName, q: null, isActive: null, sort: null, order: null });
  };

  const resetConditions = () => {
    setSearchInput('');
    updateParams({ q: null, isActive: null, sort: null, order: null });
  };

  const handleSort = (column: string) => {
    if (sort !== column) {
      updateParams({ sort: column, order: 'asc' });
    } else if (order === 'asc') {
      updateParams({ sort: column, order: 'desc' });
    } else {
      updateParams({ sort: null, order: null });
    }
  };

  const data = rowsQuery.data;
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + pageSize, total);
  const effectiveSort = sort ?? selected?.defaultSort;
  const effectiveOrder = order ?? selected?.defaultOrder;
  const refreshing = rowsQuery.isFetching && Boolean(data);

  return (
    <main className="page master-page">
      <PageHeader
        eyebrow="MASTER DATA"
        title="マスタ管理"
        description="マスタテーブルの内容を確認・編集します。"
        showDate={false}
      />

      {definitionsQuery.isLoading ? <LoadingState /> : null}
      {definitionsQuery.isError ? (
        <div className="master-panel master-error-panel">
          <ErrorAlert error={definitionsQuery.error} />
          <button
            type="button"
            className="master-reset-button"
            onClick={() => void definitionsQuery.refetch()}
          >
            再読み込み
          </button>
        </div>
      ) : null}

      {definitionsQuery.data && selected ? (
        <section className="master-panel">
          <MasterTableTabs
            tables={tables}
            selectedName={selected.name}
            onChange={changeTable}
          />
          <MasterTableToolbar
            selected={selected}
            q={searchInput}
            isActive={isActive}
            limit={pageSize}
            refreshing={refreshing}
            onQChange={setSearchInput}
            onIsActiveChange={(value) =>
              updateParams({ isActive: value === undefined ? null : String(value) })
            }
            onLimitChange={(value) => updateParams({ pageSize: String(value) })}
            onReset={resetConditions}
          />

          <div className="master-info">
            <div>
              <div className="master-title-line">
                <h2>{selected.label}</h2>
                <code>{selected.name}</code>
              </div>
              <p>{selected.description}</p>
            </div>
            <div className="master-info-meta">
              <span>
                {data
                  ? q || isActive !== undefined
                    ? `${total}件`
                    : `全${total}件`
                  : '—'}
              </span>
              <span className="master-editable-badge">編集可</span>
            </div>
          </div>

          {rowsQuery.isLoading ? <LoadingState /> : null}
          {rowsQuery.isError ? (
            <div className="master-error-panel">
              <ErrorAlert error={rowsQuery.error} />
              <button
                type="button"
                className="master-reset-button"
                onClick={() => void rowsQuery.refetch()}
              >
                再読み込み
              </button>
            </div>
          ) : null}
          {data && data.items.length === 0 ? (
            <div className="master-empty-state">条件に一致するデータがありません</div>
          ) : null}
          {data && data.items.length > 0 ? (
            <MasterDataGrid
              data={data}
              sort={effectiveSort}
              order={effectiveOrder}
              onSort={handleSort}
              onOpen={setSelectedRow}
              onEdit={(row) => {
                updateMutation.reset();
                setEditingRow(row);
              }}
            />
          ) : null}

          {data ? (
            <div className="master-pagination">
              <span>{total === 0 ? '0件' : `全${total}件中 ${from}〜${to}件`}</span>
              <div className="master-pager">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => updateParams({ page: String(page - 1) }, { resetPage: false })}
                >
                  前へ
                </button>
                <span>
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => updateParams({ page: String(page + 1) }, { resetPage: false })}
                >
                  次へ
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <MasterRecordDrawer
        open={Boolean(selectedRow)}
        tableLabel={selected?.label ?? ''}
        row={selectedRow}
        columns={data?.columns ?? []}
        onClose={closeDrawer}
      />
      <MasterEditDrawer
        open={Boolean(editingRow)}
        tableLabel={selected?.label ?? ''}
        row={editingRow}
        columns={data?.columns ?? []}
        saving={updateMutation.isPending}
        error={updateMutation.error instanceof Error ? updateMutation.error.message : null}
        onClose={closeEditor}
        onSave={(values) => updateMutation.mutate(values)}
      />
      {savedMessage ? (
        <div className="master-save-toast" role="status">
          {savedMessage}
        </div>
      ) : null}
    </main>
  );
}
