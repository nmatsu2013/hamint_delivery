import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../components/elements/PageHeader';
import { StatusPill } from '../components/elements/StatusPill';
import { ErrorAlert, LoadingState, SuccessAlert } from '../components/elements/StateViews';
import {
  createInvoice,
  getInvoice,
  getInvoices,
  recordPayment,
} from '../features/billing/api/billingApi';
import { getSalesOrders } from '../features/salesOrders/api/salesOrdersApi';
import { useAuthStore } from '../store/authStore';
import { formatCurrency, formatDate, formatNumber, todayInputValue } from '../lib/format';

export function BillingPage() {
  const role = useAuthStore((state) => state.actor?.role);
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const canEdit = role === 'accounting' || role === 'admin';

  const [orderId, setOrderId] = useState(searchParams.get('orderId') ?? '');
  const [invoiceDate, setInvoiceDate] = useState(todayInputValue());
  const [dueDate, setDueDate] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(searchParams.get('invoiceId') ?? '');
  const [paidAmount, setPaidAmount] = useState(0);
  const [paidDate, setPaidDate] = useState(todayInputValue());
  const [method, setMethod] = useState('銀行振込');
  const [fee, setFee] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  const invoicesQuery = useQuery({
    queryKey: ['invoices'],
    queryFn: () => getInvoices(),
    enabled: canEdit,
  });
  const invoices = invoicesQuery.data?.items ?? [];
  const shippedOrdersQuery = useQuery({
    queryKey: ['sales-orders', '出荷済'],
    queryFn: () => getSalesOrders({ status: '出荷済', limit: 200 }),
    enabled: canEdit,
  });
  const invoiceDetailQuery = useQuery({
    queryKey: ['invoice', selectedInvoiceId],
    queryFn: () => getInvoice(selectedInvoiceId),
    enabled: canEdit && Boolean(selectedInvoiceId),
  });

  useEffect(() => {
    const invoice = invoiceDetailQuery.data;
    if (invoice) {
      setPaidAmount(invoice.unpaidAmount);
    }
  }, [invoiceDetailQuery.data]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['invoices'] });
    void queryClient.invalidateQueries({ queryKey: ['invoice'] });
    void queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
    void queryClient.invalidateQueries({ queryKey: ['sales-order-detail'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
  };

  const createMutation = useMutation({
    mutationFn: createInvoice,
    onSuccess: (invoice) => {
      setMessage(`請求 ${invoice.invoiceNo} を作成しました（税込 ${formatCurrency(invoice.amount, invoice.currency)}）`);
      setError(null);
      setSelectedInvoiceId(invoice.id);
      invalidate();
    },
    onError: (caught) => setError(caught),
  });

  const paymentMutation = useMutation({
    mutationFn: () =>
      recordPayment(selectedInvoiceId, {
        paidAmount,
        paidDate,
        method: method || undefined,
        fee: fee || undefined,
      }),
    onSuccess: (result) => {
      setMessage(
        result.invoice.status === '入金済'
          ? `入金を登録し、請求 ${result.invoice.invoiceNo} を入金済にしました`
          : `入金を登録しました（未入金 ${formatCurrency(result.invoice.unpaidAmount, result.invoice.currency)}）`,
      );
      setError(null);
      invalidate();
    },
    onError: (caught) => setError(caught),
  });

  const submitInvoice = () => {
    setMessage(null);
    setError(null);
    if (!orderId) {
      setError(new Error('受注を選択してください'));
      return;
    }
    createMutation.mutate({
      salesOrderId: orderId,
      invoiceDate: invoiceDate || undefined,
      dueDate: dueDate || undefined,
    });
  };

  const submitPayment = () => {
    setMessage(null);
    setError(null);
    if (!selectedInvoiceId) {
      setError(new Error('請求を選択してください'));
      return;
    }
    if (!paidAmount || paidAmount <= 0) {
      setError(new Error('入金額は0より大きい必要があります'));
      return;
    }
    paymentMutation.mutate();
  };

  return (
    <main className="page">
      <PageHeader
        eyebrow="BILLING & PAYMENTS"
        title="請求・入金"
        description="出荷済みの受注から請求を作成し、入金を消し込みます。未入金額は都度算出します。"
        showDate={false}
      />

      {message ? <SuccessAlert message={message} /> : null}
      {error ? <ErrorAlert error={error} /> : null}
      {!canEdit ? (
        <div className="alert alert-info">請求・入金の操作は経理または管理者のみ実行できます。</div>
      ) : null}

      {canEdit ? (
        <section className="card card-pad">
          <h2 className="section-title">請求を作成</h2>
          <div className="form-grid">
            <div className="field span-2">
              <label htmlFor="billingOrder">出荷済みの受注</label>
              <select
                id="billingOrder"
                value={orderId}
                onChange={(event) => setOrderId(event.target.value)}
              >
                <option value="">選択してください</option>
                {(shippedOrdersQuery.data?.items ?? []).map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.orderNo}：{order.customerName}（
                    {formatCurrency(order.totalAmount, order.currency)}）
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="invoiceDate">請求日</label>
              <input
                id="invoiceDate"
                type="date"
                value={invoiceDate}
                onChange={(event) => setInvoiceDate(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="dueDate">支払期限（未入力なら30日後）</label>
              <input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>
          </div>
          <div className="inline" style={{ justifyContent: 'space-between', marginTop: 16 }}>
            <span className="subtle">
              税抜合計に10%の消費税を加算し、請求明細は税抜で保存します。
            </span>
            <button
              type="button"
              className="btn btn-primary"
              disabled={createMutation.isPending}
              onClick={submitInvoice}
            >
              {createMutation.isPending ? '作成中…' : '請求を作成'}
            </button>
          </div>
        </section>
      ) : null}

      {canEdit ? (
        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">請求一覧</h2>
              <p className="card-subtitle">未入金額は請求金額 − 入金合計で算出します</p>
            </div>
          </div>
          {invoicesQuery.isLoading ? <LoadingState /> : null}
          {invoicesQuery.isError ? (
            <div className="card-pad">
              <ErrorAlert error={invoicesQuery.error} />
            </div>
          ) : null}
          {invoicesQuery.data ? (
            invoices.length === 0 ? (
              <div className="empty-state">請求はまだありません</div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>請求番号</th>
                      <th>顧客</th>
                      <th>対象受注</th>
                      <th>請求日</th>
                      <th>支払期限</th>
                      <th>状態</th>
                      <th className="align-right">請求金額</th>
                      <th className="align-right">入金済</th>
                      <th className="align-right">未入金</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td className="mono">{invoice.invoiceNo}</td>
                        <td>{invoice.customerName}</td>
                        <td className="mono">{invoice.orderNos.join(', ') || '—'}</td>
                        <td className="nowrap">{formatDate(invoice.invoiceDate)}</td>
                        <td className="nowrap">{formatDate(invoice.dueDate)}</td>
                        <td>
                          <StatusPill status={invoice.status} />
                        </td>
                        <td className="align-right amount">
                          {formatCurrency(invoice.amount, invoice.currency)}
                        </td>
                        <td className="align-right amount">
                          {formatCurrency(invoice.paidAmount, invoice.currency)}
                        </td>
                        <td className="align-right amount">
                          {formatCurrency(invoice.unpaidAmount, invoice.currency)}
                        </td>
                        <td className="align-right">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setSelectedInvoiceId(invoice.id);
                              setMessage(null);
                              setError(null);
                            }}
                          >
                            詳細
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}
        </section>
      ) : null}

      {canEdit && selectedInvoiceId ? (
        <section className="card card-pad">
          <div className="inline" style={{ justifyContent: 'space-between' }}>
            <h2 className="section-title" style={{ marginBottom: 0 }}>
              請求詳細
            </h2>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setSelectedInvoiceId('')}
            >
              閉じる
            </button>
          </div>
          {invoiceDetailQuery.isLoading ? <LoadingState /> : null}
          {invoiceDetailQuery.isError ? <ErrorAlert error={invoiceDetailQuery.error} /> : null}
          {invoiceDetailQuery.data ? (
            <>
              <div className="info-grid" style={{ marginTop: 16 }}>
                <div className="info-item">
                  <span className="info-label">請求番号</span>
                  <span className="info-value mono">{invoiceDetailQuery.data.invoiceNo}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">顧客</span>
                  <span className="info-value">{invoiceDetailQuery.data.customerName}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">状態</span>
                  <span className="info-value">
                    <StatusPill status={invoiceDetailQuery.data.status} />
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">請求金額（税込）</span>
                  <span className="info-value">
                    {formatCurrency(
                      invoiceDetailQuery.data.amount,
                      invoiceDetailQuery.data.currency,
                    )}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">入金済</span>
                  <span className="info-value">
                    {formatCurrency(
                      invoiceDetailQuery.data.paidAmount,
                      invoiceDetailQuery.data.currency,
                    )}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">未入金額（動的算出）</span>
                  <span className="info-value" style={{ color: '#9A2B1F' }}>
                    {formatCurrency(
                      invoiceDetailQuery.data.unpaidAmount,
                      invoiceDetailQuery.data.currency,
                    )}
                  </span>
                </div>
              </div>

              <div className="table-wrap" style={{ marginTop: 20 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>請求明細（税抜）</th>
                      <th className="align-right">数量</th>
                      <th className="align-right">金額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceDetailQuery.data.lines.map((line) => (
                      <tr key={line.id}>
                        <td>{line.productName ?? '—'}</td>
                        <td className="align-right">{formatNumber(line.quantity ?? 0)}</td>
                        <td className="align-right amount">
                          {formatCurrency(line.amount, line.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="table-wrap" style={{ marginTop: 20 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>入金日</th>
                      <th className="align-right">入金額</th>
                      <th>方法</th>
                      <th className="align-right">手数料</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceDetailQuery.data.payments.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="subtle">
                          入金はまだありません
                        </td>
                      </tr>
                    ) : (
                      invoiceDetailQuery.data.payments.map((payment) => (
                        <tr key={payment.id}>
                          <td className="nowrap">{formatDate(payment.paidDate)}</td>
                          <td className="align-right amount">
                            {formatCurrency(payment.paidAmount, payment.currency)}
                          </td>
                          <td>{payment.method ?? '—'}</td>
                          <td className="align-right">
                            {payment.fee ? formatCurrency(payment.fee, payment.currency) : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {invoiceDetailQuery.data.status !== '入金済' ? (
                <>
                  <h3 className="section-title" style={{ marginTop: 24, fontSize: 18 }}>
                    入金を登録
                  </h3>
                  <div className="form-grid three">
                    <div className="field">
                      <label htmlFor="paidAmount">入金額</label>
                      <input
                        id="paidAmount"
                        type="number"
                        min={0}
                        value={paidAmount}
                        onChange={(event) => setPaidAmount(Number(event.target.value))}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="paidDate">入金日</label>
                      <input
                        id="paidDate"
                        type="date"
                        value={paidDate}
                        onChange={(event) => setPaidDate(event.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="method">入金方法</label>
                      <input
                        id="method"
                        type="text"
                        value={method}
                        onChange={(event) => setMethod(event.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="fee">振込手数料</label>
                      <input
                        id="fee"
                        type="number"
                        min={0}
                        value={fee}
                        onChange={(event) => setFee(Number(event.target.value))}
                      />
                    </div>
                  </div>
                  <div className="inline" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={paymentMutation.isPending}
                      onClick={submitPayment}
                    >
                      {paymentMutation.isPending ? '登録中…' : '入金を登録'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="alert alert-success" style={{ marginTop: 20 }}>
                  入金済みです。受注は完了ステータスに遷移しています。
                </div>
              )}
            </>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
