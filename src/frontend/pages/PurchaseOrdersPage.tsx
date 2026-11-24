import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../components/elements/PageHeader';
import { ErrorAlert, LoadingState, SuccessAlert } from '../components/elements/StateViews';
import {
  createPurchaseOrdersFromSo,
  getPurchaseOrders,
} from '../features/purchaseOrders/api/purchaseOrdersApi';
import { PurchaseOrdersTable } from '../features/purchaseOrders/components/PurchaseOrdersTable';
import { getSalesOrderDetail, getSalesOrders } from '../features/salesOrders/api/salesOrdersApi';
import { formatCurrency, formatNumber } from '../lib/format';

export function PurchaseOrdersPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const initialOrderId = searchParams.get('orderId') ?? '';
  const [selectedOrderId, setSelectedOrderId] = useState(initialOrderId);
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>([]);
  const [promisedDate, setPromisedDate] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  const poQuery = useQuery({ queryKey: ['purchase-orders'], queryFn: () => getPurchaseOrders() });
  const ordersQuery = useQuery({
    queryKey: ['sales-orders', '受付'],
    queryFn: () => getSalesOrders({ status: '受付', limit: 200 }),
  });
  const orderDetailQuery = useQuery({
    queryKey: ['sales-order-detail', selectedOrderId],
    queryFn: () => getSalesOrderDetail(selectedOrderId),
    enabled: Boolean(selectedOrderId),
  });

  useEffect(() => {
    if (!orderDetailQuery.data) return;
    setSelectedLineIds(
      orderDetailQuery.data.order.lines
        .filter((line) => line.lineStatus === '受付')
        .map((line) => line.id),
    );
  }, [orderDetailQuery.data]);

  const createMutation = useMutation({
    mutationFn: createPurchaseOrdersFromSo,
    onSuccess: (result) => {
      setMessage(`発注を作成しました：${result.items.map((po) => po.poNo).join(', ')}`);
      setError(null);
      setSelectedLineIds([]);
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      void queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      void queryClient.invalidateQueries({ queryKey: ['sales-order-detail'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
    },
    onError: (caught) => setError(caught),
  });

  const selectedOrderLines = useMemo(
    () => (orderDetailQuery.data?.order.lines ?? []).filter((line) => line.lineStatus === '受付'),
    [orderDetailQuery.data],
  );

  const toggleLine = (lineId: string) => {
    setSelectedLineIds((current) =>
      current.includes(lineId) ? current.filter((id) => id !== lineId) : [...current, lineId],
    );
  };

  const submit = () => {
    setError(null);
    setMessage(null);
    if (selectedLineIds.length === 0) {
      setError(new Error('発注する受注明細を1件以上選択してください'));
      return;
    }
    createMutation.mutate({
      salesOrderLineIds: selectedLineIds,
      promisedDate: promisedDate || undefined,
      note: note || undefined,
    });
  };

  return (
    <main className="page">
      <PageHeader
        eyebrow="PURCHASE ORDERS"
        title="発注管理"
        description="受付の受注明細から、仕入先ごとの発注を作成・確定します。"
        showDate={false}
      />

      {message ? <SuccessAlert message={message} /> : null}
      {error ? <ErrorAlert error={error} /> : null}
      {createMutation.isError ? <ErrorAlert error={createMutation.error} /> : null}

      <section className="card card-pad">
          <h2 className="section-title">受注明細から発注を作成</h2>
          <div className="form-grid">
            <div className="field span-2">
              <label htmlFor="sourceOrder">受付の受注</label>
              <select
                id="sourceOrder"
                value={selectedOrderId}
                onChange={(event) => {
                  setSelectedOrderId(event.target.value);
                  setSelectedLineIds([]);
                }}
              >
                <option value="">選択してください</option>
                {(ordersQuery.data?.items ?? []).map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.orderNo}：{order.customerName}（{order.mainProductName}）
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="promisedDate">納品回答日</label>
              <input
                id="promisedDate"
                type="date"
                value={promisedDate}
                onChange={(event) => setPromisedDate(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="poNote">備考</label>
              <input
                id="poNote"
                type="text"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
          </div>

          {orderDetailQuery.isLoading ? <LoadingState /> : null}
          {orderDetailQuery.data && selectedOrderLines.length > 0 ? (
            <>
              <div className="table-wrap" style={{ marginTop: 20 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>選択</th>
                      <th>製品</th>
                      <th className="align-right">数量</th>
                      <th className="align-right">確定単価</th>
                      <th className="align-right">金額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrderLines.map((line) => (
                      <tr key={line.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedLineIds.includes(line.id)}
                            onChange={() => toggleLine(line.id)}
                            aria-label={`${line.productName} を選択`}
                          />
                        </td>
                        <td>
                          <div style={{ fontWeight: 700 }}>{line.productName}</div>
                          <div className="subtle">{line.productCode}</div>
                        </td>
                        <td className="align-right nowrap">{formatNumber(line.quantity)}</td>
                        <td className="align-right amount">
                          {formatCurrency(line.unitPrice, line.currency)}
                        </td>
                        <td className="align-right amount">
                          {formatCurrency(line.unitPrice * line.quantity, line.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="inline" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={createMutation.isPending}
                  onClick={submit}
                >
                  {createMutation.isPending ? '作成中…' : '発注を作成・確定'}
                </button>
              </div>
            </>
          ) : null}
          {orderDetailQuery.data && selectedOrderLines.length === 0 ? (
            <div className="alert alert-info" style={{ marginTop: 16 }}>
              この受注には「受付」の明細がありません。
            </div>
          ) : null}
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">発注一覧</h2>
            <p className="card-subtitle">仕入先ごとにまとめた発注の状況です</p>
          </div>
          <Link className="btn btn-secondary btn-sm" to="/warehouse">
            入庫・検品へ
          </Link>
        </div>
        {poQuery.isLoading ? <LoadingState /> : null}
        {poQuery.isError ? (
          <div className="card-pad">
            <ErrorAlert error={poQuery.error} />
          </div>
        ) : null}
        {poQuery.data ? (
          <PurchaseOrdersTable items={poQuery.data.items} showAmount />
        ) : null}
      </section>
    </main>
  );
}
