import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../components/elements/PageHeader';
import { ErrorAlert, LoadingState, SuccessAlert } from '../components/elements/StateViews';
import { getSalesOrderDetail, getSalesOrders } from '../features/salesOrders/api/salesOrdersApi';
import { getPurchaseOrders } from '../features/purchaseOrders/api/purchaseOrdersApi';
import { getAvailableLots } from '../features/warehouse/api/warehouseApi';
import {
  createDomesticShipment,
  createInternationalShipment,
  getShipments,
  markShipmentDelivered,
} from '../features/shipments/api/shipmentsApi';
import { ShipmentsTable } from '../features/shipments/components/ShipmentsTable';
import { formatNumber, todayInputValue } from '../lib/format';

interface DomesticLineInput {
  lotId: string;
  quantity: number;
}

export function ShipmentsPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const orderIdParam = searchParams.get('orderId') ?? '';

  const [orderId, setOrderId] = useState(orderIdParam);
  const [carrier, setCarrier] = useState('ヤマト運輸');
  const [trackingNo, setTrackingNo] = useState('');
  const [shippedDate, setShippedDate] = useState(todayInputValue());
  const [fifoOverrideReason, setFifoOverrideReason] = useState('');
  const [domesticLines, setDomesticLines] = useState<Record<string, DomesticLineInput>>({});
  const [poId, setPoId] = useState('');
  const [intlCarrier, setIntlCarrier] = useState('DHL');
  const [blAwbNo, setBlAwbNo] = useState('');
  const [intlShippedDate, setIntlShippedDate] = useState(todayInputValue());
  const [transportMode, setTransportMode] = useState('航空便');
  const [etd, setEtd] = useState('');
  const [eta, setEta] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  const shipmentsQuery = useQuery({ queryKey: ['shipments'], queryFn: () => getShipments() });
  const ordersQuery = useQuery({
    queryKey: ['sales-orders', '入荷済'],
    queryFn: () => getSalesOrders({ status: '入荷済', limit: 200 }),
  });
  const orderDetailQuery = useQuery({
    queryKey: ['sales-order-detail', orderId],
    queryFn: () => getSalesOrderDetail(orderId),
    enabled: Boolean(orderId),
  });
  const lotsQuery = useQuery({
    queryKey: ['available-lots'],
    queryFn: () => getAvailableLots(),
  });
  const poQuery = useQuery({
    queryKey: ['purchase-orders', '発注済'],
    queryFn: () => getPurchaseOrders({ status: '発注済' }),
  });

  useEffect(() => {
    if (!orderDetailQuery.data) return;
    const next: Record<string, DomesticLineInput> = {};
    for (const line of orderDetailQuery.data.order.lines) {
      const remaining = line.quantity - line.shippedQuantity;
      if (remaining <= 0) continue;
      const lots = (lotsQuery.data?.items ?? []).filter((lot) => lot.productId === line.productId);
      next[line.id] = { lotId: lots[0]?.id ?? '', quantity: remaining };
    }
    setDomesticLines(next);
  }, [orderDetailQuery.data, lotsQuery.data]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['shipments'] });
    void queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
    void queryClient.invalidateQueries({ queryKey: ['sales-order-detail'] });
    void queryClient.invalidateQueries({ queryKey: ['available-lots'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
  };

  const domesticMutation = useMutation({
    mutationFn: createDomesticShipment,
    onSuccess: (result) => {
      setMessage(
        result.alreadyProcessed
          ? '同じ出荷確定を処理済みのため、在庫は減算していません（冪等）'
          : `国内出荷を登録しました：${result.shipment.shipmentNo}`,
      );
      setError(null);
      setTrackingNo('');
      invalidate();
    },
    onError: (caught) => setError(caught),
  });

  const internationalMutation = useMutation({
    mutationFn: createInternationalShipment,
    onSuccess: (shipment) => {
      setMessage(`国際輸送を登録しました：${shipment.shipmentNo}`);
      setError(null);
      setBlAwbNo('');
      void queryClient.invalidateQueries({ queryKey: ['shipments'] });
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      void queryClient.invalidateQueries({ queryKey: ['sales-order-detail'] });
    },
    onError: (caught) => setError(caught),
  });

  const deliverMutation = useMutation({
    mutationFn: ({ id, deliveredDate }: { id: string; deliveredDate: string }) =>
      markShipmentDelivered(id, deliveredDate),
    onSuccess: (shipment) => {
      setMessage(`${shipment.shipmentNo} を納品済みにしました`);
      setError(null);
      invalidate();
    },
    onError: (caught) => setError(caught),
  });

  const submitDomestic = () => {
    setMessage(null);
    setError(null);
    if (!orderId) {
      setError(new Error('受注を選択してください'));
      return;
    }
    if (!carrier || !trackingNo || !shippedDate) {
      setError(new Error('配送業者・追跡番号・発送日は必須です'));
      return;
    }
    const lines = Object.entries(domesticLines)
      .filter(([, value]) => value.lotId && value.quantity > 0)
      .map(([salesOrderLineId, value]) => ({
        salesOrderLineId,
        lotId: value.lotId,
        quantity: value.quantity,
      }));
    if (lines.length === 0) {
      setError(new Error('出荷する明細とロットを選択してください'));
      return;
    }
    domesticMutation.mutate({
      salesOrderId: orderId,
      carrier,
      trackingNo,
      shippedDate,
      fifoOverrideReason: fifoOverrideReason || undefined,
      lines,
    });
  };

  const submitInternational = () => {
    setMessage(null);
    setError(null);
    if (!poId || !blAwbNo || !intlShippedDate) {
      setError(new Error('発注・AWB/BL番号・発送日は必須です'));
      return;
    }
    internationalMutation.mutate({
      purchaseOrderId: poId,
      carrier: intlCarrier,
      blAwbNo,
      shippedDate: intlShippedDate,
      transportMode: transportMode || undefined,
      etd: etd || undefined,
      eta: eta || undefined,
    });
  };

  const updateDomesticLine = (lineId: string, patch: Partial<DomesticLineInput>) => {
    setDomesticLines((current) => ({
      ...current,
      [lineId]: { ...current[lineId], ...patch } as DomesticLineInput,
    }));
  };

  const remainingLines = useMemo(
    () =>
      (orderDetailQuery.data?.order.lines ?? []).filter(
        (line) => line.quantity - line.shippedQuantity > 0,
      ),
    [orderDetailQuery.data],
  );

  return (
    <main className="page">
      <PageHeader
        eyebrow="SHIPMENTS"
        title="出荷・配送"
        description="使用期限の近いロットから国内出荷し、追跡番号と納品日を記録します。"
        showDate={false}
      />

      {message ? <SuccessAlert message={message} /> : null}
      {error ? <ErrorAlert error={error} /> : null}

      <section className="card card-pad">
          <h2 className="section-title">国内出荷を登録</h2>
          <div className="form-grid">
            <div className="field span-2">
              <label htmlFor="orderId">受注</label>
              <select id="orderId" value={orderId} onChange={(event) => setOrderId(event.target.value)}>
                <option value="">選択してください</option>
                {(ordersQuery.data?.items ?? []).map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.orderNo}：{order.customerName}（{order.status}）
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="carrier">配送業者</label>
              <input
                id="carrier"
                type="text"
                value={carrier}
                onChange={(event) => setCarrier(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="trackingNo">追跡番号</label>
              <input
                id="trackingNo"
                type="text"
                value={trackingNo}
                onChange={(event) => setTrackingNo(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="shippedDate">発送日</label>
              <input
                id="shippedDate"
                type="date"
                value={shippedDate}
                onChange={(event) => setShippedDate(event.target.value)}
              />
            </div>
            <div className="field span-2">
              <label htmlFor="fifoReason">FIFO例外理由（任意）</label>
              <input
                id="fifoReason"
                type="text"
                value={fifoOverrideReason}
                onChange={(event) => setFifoOverrideReason(event.target.value)}
                placeholder="使用期限の近いロットがある場合、違うロットを選ぶ理由を記録します"
              />
            </div>
          </div>

          {orderDetailQuery.isLoading || lotsQuery.isLoading ? <LoadingState /> : null}
          {orderDetailQuery.data && remainingLines.length > 0 ? (
            <div className="table-wrap" style={{ marginTop: 20 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>製品</th>
                    <th className="align-right">受注数量</th>
                    <th className="align-right">出荷済</th>
                    <th className="align-right">出荷数量</th>
                    <th>ロット</th>
                  </tr>
                </thead>
                <tbody>
                  {remainingLines.map((line) => {
                    const lots = (lotsQuery.data?.items ?? []).filter(
                      (lot) => lot.productId === line.productId,
                    );
                    const input = domesticLines[line.id] ?? {
                      lotId: lots[0]?.id ?? '',
                      quantity: line.quantity - line.shippedQuantity,
                    };
                    return (
                      <tr key={line.id}>
                        <td>
                          <div style={{ fontWeight: 700 }}>{line.productName}</div>
                          <div className="subtle">{line.productCode}</div>
                        </td>
                        <td className="align-right">{formatNumber(line.quantity)}</td>
                        <td className="align-right">{formatNumber(line.shippedQuantity)}</td>
                        <td className="align-right" style={{ minWidth: 120 }}>
                          <input
                            type="number"
                            min={1}
                            max={line.quantity - line.shippedQuantity}
                            value={input.quantity}
                            onChange={(event) =>
                              updateDomesticLine(line.id, { quantity: Number(event.target.value) })
                            }
                            style={{
                              width: 90,
                              padding: '6px 8px',
                              borderRadius: 8,
                              border: '1px solid #cbd6e2',
                              textAlign: 'right',
                            }}
                          />
                        </td>
                        <td>
                          <select
                            value={input.lotId}
                            onChange={(event) =>
                              updateDomesticLine(line.id, { lotId: event.target.value })
                            }
                            style={{
                              padding: '6px 8px',
                              borderRadius: 8,
                              border: '1px solid #cbd6e2',
                              minWidth: 220,
                            }}
                          >
                            <option value="">ロットを選択</option>
                            {lots.map((lot) => (
                              <option key={lot.id} value={lot.id}>
                                {lot.lotNo}（期限 {lot.expiryDate} / 在庫 {lot.onHandQty}）
                              </option>
                            ))}
                          </select>
                          <div className="subtle">推奨：使用期限の近い順に表示しています。</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
          {orderDetailQuery.data && remainingLines.length === 0 ? (
            <div className="alert alert-info" style={{ marginTop: 16 }}>
              この受注はすべて出荷済みです。
            </div>
          ) : null}
          <div className="inline" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={domesticMutation.isPending}
              onClick={submitDomestic}
            >
              {domesticMutation.isPending ? '登録中…' : '国内出荷を確定'}
            </button>
          </div>
      </section>

      <section className="card card-pad">
          <h2 className="section-title">国際輸送を登録</h2>
          <div className="form-grid">
            <div className="field span-2">
              <label htmlFor="poId">発注</label>
              <select id="poId" value={poId} onChange={(event) => setPoId(event.target.value)}>
                <option value="">選択してください</option>
                {(poQuery.data?.items ?? []).map((po) => (
                  <option key={po.id} value={po.id}>
                    {po.poNo}：{po.supplierName}（{po.status}）
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="intlCarrier">配送業者</label>
              <input
                id="intlCarrier"
                type="text"
                value={intlCarrier}
                onChange={(event) => setIntlCarrier(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="blAwbNo">AWB / BL番号</label>
              <input
                id="blAwbNo"
                type="text"
                value={blAwbNo}
                onChange={(event) => setBlAwbNo(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="intlShippedDate">発送日</label>
              <input
                id="intlShippedDate"
                type="date"
                value={intlShippedDate}
                onChange={(event) => setIntlShippedDate(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="transportMode">輸送手段</label>
              <select
                id="transportMode"
                value={transportMode}
                onChange={(event) => setTransportMode(event.target.value)}
              >
                {['航空便', '船便', '国際宅配'].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="etd">ETD（出発予定日）</label>
              <input
                id="etd"
                type="date"
                value={etd}
                onChange={(event) => setEtd(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="eta">ETA（到着予定日）</label>
              <input
                id="eta"
                type="date"
                value={eta}
                onChange={(event) => setEta(event.target.value)}
              />
            </div>
          </div>
          <div className="inline" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={internationalMutation.isPending}
              onClick={submitInternational}
            >
              {internationalMutation.isPending ? '登録中…' : '国際輸送を登録'}
            </button>
          </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">配送一覧</h2>
            <p className="card-subtitle">国内配送・国際輸送の追跡状況です</p>
          </div>
        </div>
        {shipmentsQuery.isLoading ? <LoadingState /> : null}
        {shipmentsQuery.isError ? (
          <div className="card-pad">
            <ErrorAlert error={shipmentsQuery.error} />
          </div>
        ) : null}
        {shipmentsQuery.data ? (
          <ShipmentsTable
            items={shipmentsQuery.data.items}
            onDeliver={(id, deliveredDate) => deliverMutation.mutate({ id, deliveredDate })}
            delivering={deliverMutation.isPending}
          />
        ) : null}
      </section>
    </main>
  );
}
