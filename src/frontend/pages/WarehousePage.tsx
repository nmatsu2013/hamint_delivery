import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../components/elements/PageHeader';
import { StatusPill } from '../components/elements/StatusPill';
import { ErrorAlert, LoadingState, SuccessAlert } from '../components/elements/StateViews';
import {
  getPurchaseOrder,
  getPurchaseOrders,
  inspectPurchaseOrderLine,
} from '../features/purchaseOrders/api/purchaseOrdersApi';
import { getAvailableLots } from '../features/warehouse/api/warehouseApi';
import { useAuthStore } from '../store/authStore';
import { formatDate, formatNumber, todayInputValue } from '../lib/format';
import type { PurchaseOrderLine } from '../types/api';

export function WarehousePage() {
  const role = useAuthStore((state) => state.actor?.role);
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const initialPoId = searchParams.get('poId') ?? '';
  const canEdit = role === 'warehouse' || role === 'admin';

  const [poId, setPoId] = useState(initialPoId);
  const [selectedLine, setSelectedLine] = useState<PurchaseOrderLine | null>(null);
  const [receivedDate, setReceivedDate] = useState(todayInputValue());
  const [goodQty, setGoodQty] = useState(0);
  const [defectQty, setDefectQty] = useState(0);
  const [damagedQty, setDamagedQty] = useState(0);
  const [lotNo, setLotNo] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [manufacturedDate, setManufacturedDate] = useState('');
  const [claimStatus, setClaimStatus] = useState('なし');
  const [claimNote, setClaimNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  const poListQuery = useQuery({
    queryKey: ['purchase-orders'],
    queryFn: () => getPurchaseOrders(),
  });
  const poDetailQuery = useQuery({
    queryKey: ['purchase-order', poId],
    queryFn: () => getPurchaseOrder(poId),
    enabled: Boolean(poId),
  });
  const lotsQuery = useQuery({
    queryKey: ['available-lots'],
    queryFn: () => getAvailableLots(),
  });

  const chooseLine = (line: PurchaseOrderLine) => {
    setSelectedLine(line);
    setGoodQty(line.quantity);
    setDefectQty(0);
    setDamagedQty(0);
    setLotNo('');
    setExpiryDate('');
    setManufacturedDate('');
    setClaimStatus('なし');
    setClaimNote('');
    setMessage(null);
    setError(null);
  };

  useEffect(() => {
    if (!poDetailQuery.data || selectedLine) return;
    const pending = poDetailQuery.data.lines.find((line) => line.receivedDate === null);
    if (pending) {
      chooseLine(pending);
    }
  }, [poDetailQuery.data, selectedLine]);

  const inspectMutation = useMutation({
    mutationFn: () =>
      inspectPurchaseOrderLine(poId, {
        poLineId: selectedLine?.id as string,
        receivedDate,
        goodQty,
        defectQty,
        damagedQty,
        lotNo: lotNo || undefined,
        expiryDate: expiryDate || undefined,
        manufacturedDate: manufacturedDate || undefined,
        claimStatus: claimStatus || undefined,
        claimNote: claimNote || undefined,
      }),
    onSuccess: (result) => {
      const lot = result.lot as { lotNo?: string; onHandQty?: number } | null;
      setMessage(
        `検品を登録しました${lot?.lotNo ? `（ロット ${lot.lotNo} / 在庫 ${lot.onHandQty ?? 0}）` : ''}`,
      );
      setError(null);
      setSelectedLine(null);
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      void queryClient.invalidateQueries({ queryKey: ['purchase-order', poId] });
      void queryClient.invalidateQueries({ queryKey: ['available-lots'] });
      void queryClient.invalidateQueries({ queryKey: ['sales-order-detail'] });
      void queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
    },
    onError: (caught) => setError(caught),
  });

  const pendingLines = useMemo(
    () => (poDetailQuery.data?.lines ?? []).filter((line) => line.receivedDate === null),
    [poDetailQuery.data],
  );

  const submit = () => {
    setMessage(null);
    setError(null);
    if (!selectedLine) {
      setError(new Error('検品する明細を選択してください'));
      return;
    }
    if (goodQty + defectQty + damagedQty !== selectedLine.quantity) {
      setError(
        new Error(
          `良品数・不良数・破損数の合計を発注数量（${selectedLine.quantity}）に一致させてください`,
        ),
      );
      return;
    }
    if (goodQty > 0 && (!lotNo || !expiryDate)) {
      setError(new Error('良品数が1以上の場合、ロット番号と使用期限は必須です'));
      return;
    }
    inspectMutation.mutate();
  };

  return (
    <main className="page">
      <PageHeader
        eyebrow="WAREHOUSE & LOTS"
        title="入庫・検品・ロット管理"
        description="発注明細ごとに良品・不良・破損を記録し、良品をロットとして登録します。"
        showDate={false}
      />

      {message ? <SuccessAlert message={message} /> : null}
      {error ? <ErrorAlert error={error} /> : null}
      {inspectMutation.isError ? <ErrorAlert error={inspectMutation.error} /> : null}
      {!canEdit ? (
        <div className="alert alert-info">
          入庫・検品の登録は倉庫または管理者のみ実行できます。閲覧のみ可能です。
        </div>
      ) : null}

      <section className="card card-pad">
        <h2 className="section-title">発注を選択</h2>
        <div className="form-grid">
          <div className="field span-2">
            <label htmlFor="poSelect">発注</label>
            <select id="poSelect" value={poId} onChange={(event) => setPoId(event.target.value)}>
              <option value="">選択してください</option>
              {(poListQuery.data?.items ?? []).map((po) => (
                <option key={po.id} value={po.id}>
                  {po.poNo}：{po.supplierName}（{po.status}）
                </option>
              ))}
            </select>
          </div>
        </div>
        {poListQuery.isLoading ? <LoadingState /> : null}
        {poListQuery.isError ? <ErrorAlert error={poListQuery.error} /> : null}

        {poDetailQuery.isLoading ? <LoadingState /> : null}
        {poDetailQuery.data ? (
          <>
            <div className="inline" style={{ marginTop: 16 }}>
              <span className="mono">{poDetailQuery.data.poNo}</span>
              <StatusPill status={poDetailQuery.data.status} />
              <span className="subtle">納期回答：{formatDate(poDetailQuery.data.promisedDate)}</span>
            </div>
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>製品</th>
                    <th className="align-right">発注数量</th>
                    <th className="align-right">良品</th>
                    <th className="align-right">不良</th>
                    <th className="align-right">破損</th>
                    <th>入庫日</th>
                    <th>クレーム</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {poDetailQuery.data.lines.map((line) => (
                    <tr key={line.id}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{line.productName}</div>
                        <div className="subtle">{line.productCode}</div>
                      </td>
                      <td className="align-right">{formatNumber(line.quantity)}</td>
                      <td className="align-right">{line.goodQty ?? '—'}</td>
                      <td className="align-right">{line.defectQty ?? '—'}</td>
                      <td className="align-right">{line.damagedQty ?? '—'}</td>
                      <td className="nowrap">{formatDate(line.receivedDate)}</td>
                      <td>{line.claimStatus ?? '—'}</td>
                      <td className="align-right">
                        {line.receivedDate === null && canEdit ? (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => chooseLine(line)}
                          >
                            検品登録
                          </button>
                        ) : (
                          <span className="subtle">完了</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pendingLines.length === 0 ? (
              <div className="alert alert-info" style={{ marginTop: 16 }}>
                この発注はすべて検品済みです。
              </div>
            ) : null}
          </>
        ) : null}
      </section>

      {selectedLine ? (
        <section className="card card-pad">
          <h2 className="section-title">
            検品登録：{selectedLine.productName}（発注数 {formatNumber(selectedLine.quantity)}）
          </h2>
          <div className="form-grid three">
            <div className="field">
              <label htmlFor="receivedDate">入庫日</label>
              <input
                id="receivedDate"
                type="date"
                value={receivedDate}
                onChange={(event) => setReceivedDate(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="goodQty">良品数</label>
              <input
                id="goodQty"
                type="number"
                min={0}
                value={goodQty}
                onChange={(event) => setGoodQty(Number(event.target.value))}
              />
            </div>
            <div className="field">
              <label htmlFor="defectQty">不良数</label>
              <input
                id="defectQty"
                type="number"
                min={0}
                value={defectQty}
                onChange={(event) => setDefectQty(Number(event.target.value))}
              />
            </div>
            <div className="field">
              <label htmlFor="damagedQty">破損数</label>
              <input
                id="damagedQty"
                type="number"
                min={0}
                value={damagedQty}
                onChange={(event) => setDamagedQty(Number(event.target.value))}
              />
            </div>
            <div className="field">
              <label htmlFor="lotNo">ロット番号</label>
              <input
                id="lotNo"
                type="text"
                value={lotNo}
                onChange={(event) => setLotNo(event.target.value)}
                placeholder="良品がある場合は必須"
              />
            </div>
            <div className="field">
              <label htmlFor="expiryDate">使用期限</label>
              <input
                id="expiryDate"
                type="date"
                value={expiryDate}
                onChange={(event) => setExpiryDate(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="manufacturedDate">製造日</label>
              <input
                id="manufacturedDate"
                type="date"
                value={manufacturedDate}
                onChange={(event) => setManufacturedDate(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="claimStatus">クレーム対応状況</label>
              <select
                id="claimStatus"
                value={claimStatus}
                onChange={(event) => setClaimStatus(event.target.value)}
              >
                {['なし', 'メーカーへ連絡', '返金・交換待ち', '完了'].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="claimNote">クレーム内容</label>
              <input
                id="claimNote"
                type="text"
                value={claimNote}
                onChange={(event) => setClaimNote(event.target.value)}
              />
            </div>
          </div>
          <div className="inline" style={{ justifyContent: 'space-between', marginTop: 16 }}>
            <span className="subtle">
              不良・破損はロットに登録されません。合計が発注数量と一致する必要があります。
            </span>
            <div className="btn-row">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedLine(null)}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!canEdit || inspectMutation.isPending}
                onClick={submit}
              >
                {inspectMutation.isPending ? '登録中…' : '検品を登録'}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">出荷可能ロット</h2>
            <p className="card-subtitle">使用期限内で在庫があるロットを使用期限の近い順に表示します</p>
          </div>
        </div>
        {lotsQuery.isLoading ? <LoadingState /> : null}
        {lotsQuery.isError ? (
          <div className="card-pad">
            <ErrorAlert error={lotsQuery.error} />
          </div>
        ) : null}
        {lotsQuery.data ? (
          lotsQuery.data.items.length === 0 ? (
            <div className="empty-state">出荷可能なロットがありません</div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>製品</th>
                    <th>ロット番号</th>
                    <th>使用期限</th>
                    <th className="align-right">現在庫</th>
                    <th>状態</th>
                  </tr>
                </thead>
                <tbody>
                  {lotsQuery.data.items.map((lot) => (
                    <tr key={lot.id}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{lot.productName}</div>
                        <div className="subtle">{lot.productCode}</div>
                      </td>
                      <td className="mono">{lot.lotNo}</td>
                      <td className="nowrap">{formatDate(lot.expiryDate)}</td>
                      <td className="align-right amount">{formatNumber(lot.onHandQty)}</td>
                      <td>
                        <StatusPill status={lot.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}
      </section>
    </main>
  );
}
