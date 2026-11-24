import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../components/elements/PageHeader';
import { ErrorAlert, LoadingState } from '../components/elements/StateViews';
import { KpiCards } from '../features/salesOrders/components/KpiCards';
import { SearchInput } from '../features/salesOrders/components/SearchInput';
import { StatusFilterPills } from '../features/salesOrders/components/StatusFilterPills';
import { SalesOrdersTable } from '../features/salesOrders/components/SalesOrdersTable';
import { getDashboardKpis, getSalesOrders } from '../features/salesOrders/api/salesOrdersApi';

const PAGE_SIZE = 50;

export function OrdersListPage() {
  const [status, setStatus] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setOffset(0);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setOffset(0);
  }, [status]);

  const kpiQuery = useQuery({ queryKey: ['dashboard-kpis'], queryFn: getDashboardKpis });
  const ordersQuery = useQuery({
    queryKey: ['sales-orders', status, search, offset],
    queryFn: () => getSalesOrders({ status: status || undefined, search: search || undefined, limit: PAGE_SIZE, offset }),
  });

  const total = ordersQuery.data?.total ?? 0;
  const items = ordersQuery.data?.items ?? [];
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  const exportCsv = () => {
    const header = [
      '受注日',
      '状態',
      '受注番号',
      '顧客',
      '配送先',
      '主な製品',
      '明細数',
      '数量',
      '金額（税抜）',
      '希望納期',
      '入金状況',
    ];
    const rows = items.map((item) => [
      item.orderDate,
      item.status,
      item.orderNo,
      item.customerName,
      item.shipToName,
      item.mainProductName,
      String(item.lineCount),
      String(item.quantity),
      String(item.totalAmount),
      item.requestedDate ?? '',
      item.paymentStatus,
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `sales-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="page">
      <PageHeader
        eyebrow="SALES ORDERS"
        title="受注管理 一覧"
        description="注文から発注・輸入・出荷・入金までの進み具合を、受注ごとに確認します。"
      />

      {kpiQuery.isError ? <ErrorAlert error={kpiQuery.error} /> : null}
      {kpiQuery.data ? <KpiCards kpis={kpiQuery.data} /> : null}

      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">受注一覧</h2>
            <p className="card-subtitle">行を選ぶと受注明細が開きます</p>
          </div>
          <div className="btn-row">
            <button type="button" className="btn btn-secondary btn-sm" onClick={exportCsv}>
              CSV出力
            </button>
            <StatusFilterPills value={status} onChange={setStatus} />
            <SearchInput value={searchInput} onChange={setSearchInput} />
          </div>
        </div>

        {ordersQuery.isLoading ? <LoadingState /> : null}
        {ordersQuery.isError ? (
          <div className="card-pad">
            <ErrorAlert error={ordersQuery.error} />
          </div>
        ) : null}
        {ordersQuery.data ? <SalesOrdersTable items={items} /> : null}

        <div className="table-footer">
          <span>
            {items.length}件を表示中（全{total}件）
          </span>
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(offset - PAGE_SIZE, 0))}
            >
              前へ
            </button>
            <span>
              {page} / {totalPages}
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              次へ
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
