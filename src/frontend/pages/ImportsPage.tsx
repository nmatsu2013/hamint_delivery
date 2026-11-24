import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../components/elements/PageHeader';
import { StatusPill } from '../components/elements/StatusPill';
import { ErrorAlert, LoadingState, SuccessAlert } from '../components/elements/StateViews';
import {
  createImportApplication,
  getImportApplications,
  updateImportApplicationStatus,
} from '../features/imports/api/importsApi';
import { getPurchaseOrders } from '../features/purchaseOrders/api/purchaseOrdersApi';
import { getSalesOrderDetail } from '../features/salesOrders/api/salesOrdersApi';
import { formatDate } from '../lib/format';
import type { ImportApplication } from '../types/api';

const STATUS_OPTIONS = ['書類準備中', '申請済', '確認中', '承認', '差戻し'];

export function ImportsPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId') ?? '';

  const [selectedApplication, setSelectedApplication] = useState<ImportApplication | null>(null);
  const [poId, setPoId] = useState('');
  const [appliedDate, setAppliedDate] = useState('');
  const [applicationType, setApplicationType] = useState('輸入申請（種別は要確認）');
  const [customsBroker, setCustomsBroker] = useState('');
  const [createNote, setCreateNote] = useState('');
  const [status, setStatus] = useState('申請済');
  const [confirmedDate, setConfirmedDate] = useState('');
  const [importPermitDate, setImportPermitDate] = useState('');
  const [declarationNo, setDeclarationNo] = useState('');
  const [updateNote, setUpdateNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  const applicationsQuery = useQuery({
    queryKey: ['import-applications'],
    queryFn: () => getImportApplications(),
  });
  const purchaseOrdersQuery = useQuery({
    queryKey: ['purchase-orders'],
    queryFn: () => getPurchaseOrders(),
  });
  const orderDetailQuery = useQuery({
    queryKey: ['sales-order-detail', orderId],
    queryFn: () => getSalesOrderDetail(orderId),
    enabled: Boolean(orderId),
  });

  useEffect(() => {
    const po = orderDetailQuery.data?.purchaseOrders[0];
    if (po) {
      setPoId(po.id);
    }
  }, [orderDetailQuery.data]);

  const resetMessages = () => {
    setMessage(null);
    setError(null);
  };

  const createMutation = useMutation({
    mutationFn: createImportApplication,
    onSuccess: (application) => {
      setMessage(`輸入申請 ${application.applicationNo} を作成しました`);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['import-applications'] });
    },
    onError: (caught) => setError(caught),
  });

  const updateMutation = useMutation({
    mutationFn: (application: ImportApplication) =>
      updateImportApplicationStatus(application.id, {
        status,
        confirmedDate: confirmedDate || undefined,
        importPermitDate: importPermitDate || undefined,
        declarationNo: declarationNo || undefined,
        customsBroker: customsBroker || undefined,
        note: updateNote || undefined,
      }),
    onSuccess: (application) => {
      setMessage(`輸入申請 ${application.applicationNo} の状態を更新しました`);
      setSelectedApplication(application);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['import-applications'] });
      void queryClient.invalidateQueries({ queryKey: ['sales-order-detail'] });
    },
    onError: (caught) => setError(caught),
  });

  const selectApplication = (application: ImportApplication) => {
    setSelectedApplication(application);
    setStatus(application.status);
    setConfirmedDate(application.confirmedDate ?? '');
    setImportPermitDate(application.importPermitDate ?? '');
    setDeclarationNo(application.declarationNo ?? '');
    setCustomsBroker(application.customsBroker ?? '');
    setUpdateNote(application.note ?? '');
    resetMessages();
  };

  return (
    <main className="page">
      <PageHeader
        eyebrow="IMPORT & CUSTOMS"
        title="輸入申請・通関"
        description="発注ごとの輸入申請、必要書類、通関許可の記録を管理します。"
        showDate={false}
        actions={
          <Link to="/shipments" className="btn btn-secondary btn-sm">
            国際輸送を登録
          </Link>
        }
      />

      {message ? <SuccessAlert message={message} /> : null}
      {error ? <ErrorAlert error={error} /> : null}

      <section className="card card-pad">
          <h2 className="section-title">輸入申請を登録</h2>
          <div className="form-grid">
            <div className="field span-2">
              <label htmlFor="poId">発注</label>
              <select id="poId" value={poId} onChange={(event) => setPoId(event.target.value)}>
                <option value="">選択してください</option>
                {(purchaseOrdersQuery.data?.items ?? []).map((po) => (
                  <option key={po.id} value={po.id}>
                    {po.poNo}：{po.supplierName}（{po.status}）
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="appliedDate">申請日</label>
              <input
                id="appliedDate"
                type="date"
                value={appliedDate}
                onChange={(event) => setAppliedDate(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="applicationType">申請種別</label>
              <input
                id="applicationType"
                type="text"
                value={applicationType}
                onChange={(event) => setApplicationType(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="customsBroker">通関業者</label>
              <input
                id="customsBroker"
                type="text"
                value={customsBroker}
                onChange={(event) => setCustomsBroker(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="createNote">備考</label>
              <input
                id="createNote"
                type="text"
                value={createNote}
                onChange={(event) => setCreateNote(event.target.value)}
              />
            </div>
          </div>
          <div className="inline" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={createMutation.isPending}
              onClick={() => {
                resetMessages();
                if (!poId) {
                  setError(new Error('発注を選択してください'));
                  return;
                }
                createMutation.mutate({
                  purchaseOrderId: poId,
                  appliedDate: appliedDate || undefined,
                  applicationType: applicationType || undefined,
                  customsBroker: customsBroker || undefined,
                  note: createNote || undefined,
                });
              }}
            >
              {createMutation.isPending ? '登録中…' : '輸入申請を登録'}
            </button>
          </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">輸入申請一覧</h2>
            <p className="card-subtitle">申請書類と通関の進み具合を確認します</p>
          </div>
        </div>
        {applicationsQuery.isLoading ? <LoadingState /> : null}
        {applicationsQuery.isError ? (
          <div className="card-pad">
            <ErrorAlert error={applicationsQuery.error} />
          </div>
        ) : null}
        {applicationsQuery.data ? (
          applicationsQuery.data.items.length === 0 ? (
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
                    <th>書類</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {applicationsQuery.data.items.map((application) => (
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
                      <td>
                        {application.documents.map((document) => (
                          <div key={document.id} className="subtle">
                            {document.documentName}
                          </div>
                        ))}
                      </td>
                      <td className="align-right">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => selectApplication(application)}
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

      {selectedApplication ? (
        <section className="card card-pad">
          <div className="inline" style={{ justifyContent: 'space-between' }}>
            <h2 className="section-title" style={{ marginBottom: 0 }}>
              {selectedApplication.applicationNo} のステータス更新
            </h2>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setSelectedApplication(null)}
            >
              閉じる
            </button>
          </div>
          <div className="form-grid" style={{ marginTop: 16 }}>
            <div className="field">
              <label htmlFor="status">確認状況</label>
              <select id="status" value={status} onChange={(event) => setStatus(event.target.value)}>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="confirmedDate">確認完了日</label>
              <input
                id="confirmedDate"
                type="date"
                value={confirmedDate}
                onChange={(event) => setConfirmedDate(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="importPermitDate">輸入許可日</label>
              <input
                id="importPermitDate"
                type="date"
                value={importPermitDate}
                onChange={(event) => setImportPermitDate(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="declarationNo">申告番号</label>
              <input
                id="declarationNo"
                type="text"
                value={declarationNo}
                onChange={(event) => setDeclarationNo(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="updateBroker">通関業者</label>
              <input
                id="updateBroker"
                type="text"
                value={customsBroker}
                onChange={(event) => setCustomsBroker(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="updateNote">備考（差戻し理由など）</label>
              <input
                id="updateNote"
                type="text"
                value={updateNote}
                onChange={(event) => setUpdateNote(event.target.value)}
              />
            </div>
          </div>
          <div className="inline" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={updateMutation.isPending}
              onClick={() => {
                resetMessages();
                updateMutation.mutate(selectedApplication);
              }}
            >
              {updateMutation.isPending ? '更新中…' : 'ステータスを更新'}
            </button>
          </div>
        </section>
      ) : null}
    </main>
  );
}
