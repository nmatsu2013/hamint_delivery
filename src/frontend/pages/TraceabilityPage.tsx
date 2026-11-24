import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../components/elements/PageHeader';
import { ErrorAlert, LoadingState } from '../components/elements/StateViews';
import { getTraceability } from '../features/traceability/api/traceabilityApi';
import { formatDate, formatNumber } from '../lib/format';

export function TraceabilityPage() {
  const [input, setInput] = useState('');
  const [lotNo, setLotNo] = useState('');

  const traceQuery = useQuery({
    queryKey: ['traceability', lotNo],
    queryFn: () => getTraceability(lotNo),
    enabled: Boolean(lotNo),
  });

  const deliveries = traceQuery.data?.deliveries ?? [];

  return (
    <main className="page">
      <PageHeader
        eyebrow="TRACEABILITY"
        title="ロット回収・追跡"
        description="ロット番号から、納品先（顧客・配送先）、数量、出荷日、追跡番号を検索します。"
        showDate={false}
      />

      <section className="card card-pad">
        <h2 className="section-title">ロット番号で検索</h2>
        <div className="inline">
          <div className="field" style={{ flex: 1, minWidth: 260 }}>
            <label htmlFor="lotNo">ロット番号</label>
            <input
              id="lotNo"
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="例：SAMPLE-LOT-P004-01"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  setLotNo(input.trim());
                }
              }}
            />
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!input.trim()}
            onClick={() => setLotNo(input.trim())}
          >
            検索
          </button>
        </div>
        <p className="field-hint" style={{ marginTop: 8 }}>
          シードデータの例：SAMPLE-LOT-P004-01（みどり美容外科 本院へ50本）、SAMPLE-LOT-P005-01
        </p>
      </section>

      {traceQuery.isLoading ? <LoadingState /> : null}
      {traceQuery.isError ? <ErrorAlert error={traceQuery.error} /> : null}

      {traceQuery.data ? (
        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">納品先一覧</h2>
              <p className="card-subtitle">
                {traceQuery.data.lotNo}：{deliveries.length}件の納品記録
              </p>
            </div>
          </div>
          {deliveries.length === 0 ? (
            <div className="empty-state">このロットの出荷記録はありません</div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>製品</th>
                    <th>顧客</th>
                    <th>配送先</th>
                    <th>住所</th>
                    <th>出荷日</th>
                    <th className="align-right">数量</th>
                    <th>配送業者</th>
                    <th>追跡番号</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((delivery, index) => (
                    <tr key={`${delivery.trackingNo}-${index}`}>
                      <td>{delivery.productName}</td>
                      <td>
                        <div className="clinic-name">{delivery.customerName}</div>
                      </td>
                      <td>{delivery.shipToName}</td>
                      <td className="subtle">{delivery.address}</td>
                      <td className="nowrap">{formatDate(delivery.shippedDate)}</td>
                      <td className="align-right amount">{formatNumber(delivery.quantity)}</td>
                      <td>{delivery.carrier}</td>
                      <td className="mono">{delivery.trackingNo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
