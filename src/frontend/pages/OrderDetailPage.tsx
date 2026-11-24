import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../components/elements/PageHeader';
import { StatusPill } from '../components/elements/StatusPill';
import { ErrorAlert, LoadingState, SuccessAlert } from '../components/elements/StateViews';
import { ProgressStepper } from '../features/salesOrders/components/ProgressStepper';
import { cancelSalesOrder, getSalesOrderDetail } from '../features/salesOrders/api/salesOrdersApi';
import { formatCurrency, formatDate, formatNumber } from '../lib/format';

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: ['sales-order-detail', id],
    queryFn: () => getSalesOrderDetail(id as string),
    enabled: Boolean(id),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelSalesOrder(id as string),
    onSuccess: () => {
      setMessage('受注を取消しました');
      void queryClient.invalidateQueries({ queryKey: ['sales-order-detail', id] });
      void queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
    },
  });

  const detail = detailQuery.data;
  const order = detail?.order;

  const handleCancel = () => {
    if (!order) return;
    if (window.confirm(`受注 ${order.orderNo} を取消します。よろしいですか？`)) {
      setMessage(null);
      cancelMutation.mutate();
    }
  };

  return (
    <main className="page">
      <div className="inline" style={{ justifyContent: 'space-between' }}>
        <Link to="/orders" className="btn btn-secondary btn-sm">
          ← 受注一覧へ戻る
        </Link>
        {order ? (
          <div className="btn-row">
            <StatusPill status={order.status} />
            {order.status !== '取消' &&
            order.status !== '出荷済' &&
            order.status !== '完了' ? (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                disabled={cancelMutation.isPending}
                onClick={handleCancel}
              >
                受注を取消
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <PageHeader
        eyebrow="ORDER DETAIL"
        title={order ? `受注 ${order.orderNo}` : '受注明細'}
        description={
          order
            ? `${order.customerName ?? ''}（${order.shipToName ?? ''}）／ 受注日 ${formatDate(order.orderDate)}`
            : '受注から入金までの進み具合を確認します。'
        }
        showDate={false}
      />

      {message ? <SuccessAlert message={message} /> : null}
      {cancelMutation.isError ? <ErrorAlert error={cancelMutation.error} /> : null}
      {detailQuery.isLoading ? <LoadingState /> : null}
      {detailQuery.isError ? <ErrorAlert error={detailQuery.error} /> : null}

      {detail && order ? (
        <>
          <section className="card card-pad">
            <h2 className="section-title">進捗</h2>
            <ProgressStepper steps={detail.progress} />
          </section>

          <section className="card card-pad">
            <h2 className="section-title">受注基本情報</h2>
            <div className="info-grid">
              <Info label="顧客" value={order.customerName ?? '—'} />
              <Info label="配送先" value={order.shipToName ?? '—'} />
              <Info label="受注日" value={formatDate(order.orderDate)} />
              <Info label="希望納期" value={formatDate(order.requestedDate)} />
              <Info label="合計金額（税抜）" value={formatCurrency(order.totalAmount, order.currency)} />
              <Info label="入金状況" value={order.paymentStatus ?? '未請求'} />
              <div className="info-item" style={{ gridColumn: '1 / -1' }}>
                <span className="info-label">備考</span>
                <span className="info-value" style={{ fontWeight: 400 }}>
                  {order.note ?? '—'}
                </span>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">受注明細</h2>
                <p className="card-subtitle">確定単価は受注時点の単価です</p>
              </div>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>製品</th>
                    <th>規格</th>
                    <th className="align-right">数量</th>
                    <th className="align-right">確定単価</th>
                    <th className="align-right">金額</th>
                    <th>明細ステータス</th>
                    <th>発注番号</th>
                  </tr>
                </thead>
                <tbody>
                  {order.lines.map((line) => {
                    const po = detail.purchaseOrders.find((purchase) =>
                      purchase.lines.some((poLine) => poLine.salesOrderLineId === line.id),
                    );
                    return (
                      <tr key={line.id}>
                        <td>
                          <div style={{ fontWeight: 700 }}>{line.productName}</div>
                          <div className="subtle">{line.productCode}</div>
                        </td>
                        <td>{[line.modelNo, line.specNote].filter(Boolean).join(' / ') || '—'}</td>
                        <td className="align-right nowrap">{formatNumber(line.quantity)}</td>
                        <td className="align-right amount">
                          {formatCurrency(line.unitPrice, line.currency)}
                        </td>
                        <td className="align-right amount">
                          {formatCurrency(line.unitPrice * line.quantity, line.currency)}
                        </td>
                        <td>
                          <StatusPill status={line.lineStatus} />
                        </td>
                        <td className="mono">{po?.poNo ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">発注情報</h2>
                <p className="card-subtitle">受注明細に紐づく仕入先への発注</p>
              </div>
              <Link className="btn btn-secondary btn-sm" to={`/purchase-orders?orderId=${order.id}`}>
                発注を作成・確認
              </Link>
            </div>
            {detail.purchaseOrders.length === 0 ? (
              <div className="empty-state">まだ発注がありません</div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>発注番号</th>
                      <th>仕入先</th>
                      <th>発注日</th>
                      <th>納期回答</th>
                      <th>状態</th>
                      <th className="align-right">数量</th>
                      <th className="align-right">金額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.purchaseOrders.map((po) => (
                      <tr key={po.id}>
                        <td className="mono">{po.poNo}</td>
                        <td>{po.supplierName ?? '—'}</td>
                        <td className="nowrap">{formatDate(po.orderedDate)}</td>
                        <td className="nowrap">{formatDate(po.promisedDate)}</td>
                        <td>
                          <StatusPill status={po.status} />
                        </td>
                        <td className="align-right">
                          {formatNumber(po.lines.reduce((total, line) => total + line.quantity, 0))}
                        </td>
                        <td className="align-right amount">
                          {formatCurrency(po.totalAmount, po.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">輸入申請・国際輸送</h2>
                <p className="card-subtitle">書類準備から通関許可までの記録</p>
              </div>
              <Link className="btn btn-secondary btn-sm" to={`/imports?orderId=${order.id}`}>
                輸入申請を確認
              </Link>
            </div>
            {detail.importApplications.length === 0 ? (
              <div className="empty-state">輸入申請はまだありません</div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>申請番号</th>
                      <th>発注番号</th>
                      <th>申請種別</th>
                      <th>申請日</th>
                      <th>確認完了日</th>
                      <th>輸入許可日</th>
                      <th>状態</th>
                      <th className="align-right">書類</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.importApplications.map((application) => (
                      <tr key={application.id}>
                        <td className="mono">{application.applicationNo}</td>
                        <td className="mono">{application.purchaseOrderNo ?? '—'}</td>
                        <td>{application.applicationType}</td>
                        <td className="nowrap">{formatDate(application.appliedDate)}</td>
                        <td className="nowrap">{formatDate(application.confirmedDate)}</td>
                        <td className="nowrap">{formatDate(application.importPermitDate)}</td>
                        <td>
                          <StatusPill status={application.status} />
                        </td>
                        <td className="align-right">
                          {formatNumber(application.documents.length)}件
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">出荷・配送</h2>
                <p className="card-subtitle">ロット引当と追跡番号の記録</p>
              </div>
              <Link className="btn btn-secondary btn-sm" to={`/shipments?orderId=${order.id}`}>
                出荷を登録
              </Link>
            </div>
            {detail.shipments.length === 0 ? (
              <div className="empty-state">配送はまだありません</div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>区分</th>
                      <th>出荷番号</th>
                      <th>状態</th>
                      <th>発送日</th>
                      <th>納品日</th>
                      <th>配送業者</th>
                      <th>追跡番号</th>
                      <th>ロット / 数量</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.shipments.map((shipment) => (
                      <tr key={shipment.id}>
                        <td>{shipment.direction === 'domestic' ? '国内配送' : '国際輸送'}</td>
                        <td className="mono">{shipment.shipmentNo}</td>
                        <td>
                          <StatusPill status={shipment.status} />
                        </td>
                        <td className="nowrap">{formatDate(shipment.shippedDate)}</td>
                        <td className="nowrap">{formatDate(shipment.deliveredDate)}</td>
                        <td>{shipment.carrier ?? '—'}</td>
                        <td className="mono">{shipment.trackingNo ?? '—'}</td>
                        <td>
                          {shipment.lines.map((line) => (
                            <div key={line.id} className="subtle">
                              {line.lotNo ?? line.productName ?? line.lotId ?? '—'} ×{' '}
                              {formatNumber(line.quantity)}
                            </div>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">請求・入金</h2>
                <p className="card-subtitle">未入金額は請求金額と入金合計から算出します</p>
              </div>
              <Link className="btn btn-secondary btn-sm" to={`/billing?orderId=${order.id}`}>
                請求・入金を確認
              </Link>
            </div>
            {detail.invoices.length === 0 ? (
              <div className="empty-state">請求はまだありません</div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>請求番号</th>
                      <th>請求日</th>
                      <th>支払期限</th>
                      <th>状態</th>
                      <th className="align-right">請求金額（税込）</th>
                      <th className="align-right">入金済</th>
                      <th className="align-right">未入金</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.invoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td className="mono">{invoice.invoiceNo}</td>
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-item">
      <span className="info-label">{label}</span>
      <span className="info-value">{value}</span>
    </div>
  );
}
