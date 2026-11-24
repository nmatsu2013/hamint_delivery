import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ErrorAlert, LoadingState } from '../components/elements/StateViews';
import { KpiCards } from '../features/salesOrders/components/KpiCards';
import {
  OrderFilterControl,
  type OrderFilters,
} from '../features/salesOrders/components/OrderFilterControl';
import { SearchInput } from '../features/salesOrders/components/SearchInput';
import { SalesOrdersTable } from '../features/salesOrders/components/SalesOrdersTable';
import { getDashboardKpis, getSalesOrders } from '../features/salesOrders/api/salesOrdersApi';
import { currentDateString, formatDateWithWeekday } from '../lib/format';

const PAGE_SIZE = 50;
const EMPTY_FILTERS: OrderFilters = {
  customer: '',
  status: '',
  orderDateFrom: '',
  orderDateTo: '',
  purchaseOrderDate: '',
  arrivalDate: '',
  receivedDate: '',
};

export function OrdersListPage() {
  const [filterInputs, setFilterInputs] = useState<OrderFilters>(EMPTY_FILTERS);
  const [filters, setFilters] = useState<OrderFilters>(EMPTY_FILTERS);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters({ ...filterInputs, customer: filterInputs.customer.trim() });
      setOffset(0);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [filterInputs]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setOffset(0);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const kpiQuery = useQuery({ queryKey: ['dashboard-kpis'], queryFn: getDashboardKpis });
  const ordersQuery = useQuery({
    queryKey: ['sales-orders', filters, search, offset],
    queryFn: () =>
      getSalesOrders({
        ...filters,
        search: search || undefined,
        limit: PAGE_SIZE,
        offset,
      }),
  });

  const total = ordersQuery.data?.total ?? 0;
  const items = ordersQuery.data?.items ?? [];
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const kpis = kpiQuery.data ?? {
    todayOrdersCount: 0,
    pendingOrdersCount: 0,
    inTransitOrdersCount: 0,
    unpaidInvoicesCount: 0,
    currentMonthOrdersCount: 0,
    totalOrdersCount: total,
    statusCounts: {},
    businessDate: currentDateString(),
  };

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
    <main className="page orders-page">
      <div className="orders-page-header">
        <div>
          <h1 className="orders-title">受注管理 一覧</h1>
          <p className="orders-description">
            受注から発注・輸入・出荷・入金までの進み具合を確認します（サンプルデータ）　表示日：
            {formatDateWithWeekday(kpis.businessDate)}
          </p>
        </div>
        <KpiCards kpis={kpis} />
      </div>

      {kpiQuery.isError ? <ErrorAlert error={kpiQuery.error} /> : null}

      <section className="orders-panel">
        <div className="orders-toolbar">
          <OrderFilterControl
            values={filterInputs}
            onChange={(field, value) => {
              setFilterInputs((current) => ({ ...current, [field]: value }));
            }}
            onClear={() => {
              setFilterInputs(EMPTY_FILTERS);
              setFilters(EMPTY_FILTERS);
              setOffset(0);
            }}
          />
          <div className="orders-tools">
            <SearchInput value={searchInput} onChange={setSearchInput} />
            <button type="button" className="btn-csv" onClick={exportCsv}>
              CSV出力
            </button>
          </div>
        </div>

        {ordersQuery.isLoading ? <LoadingState /> : null}
        {ordersQuery.isError ? (
          <div className="orders-error">
            <ErrorAlert error={ordersQuery.error} />
          </div>
        ) : null}
        {ordersQuery.data ? <SalesOrdersTable items={items} /> : null}

        <div className="orders-footer">
          <span>
            {items.length}件を表示中（全{total}件）
          </span>
          <div className="pager">
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(offset - PAGE_SIZE, 0))}
            >
              前へ
            </button>
            <span>｜</span>
            <span>
              {page} / {totalPages}
            </span>
            <span>｜</span>
            <button
              type="button"
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
