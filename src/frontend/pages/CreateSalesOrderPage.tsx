import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { PageHeader } from '../components/elements/PageHeader';
import { ErrorAlert, LoadingState } from '../components/elements/StateViews';
import { getCustomers, getCustomerAddresses, getProducts, resolvePrice } from '../features/master/api/masterApi';
import { createSalesOrder } from '../features/salesOrders/api/salesOrdersApi';
import { useAuthStore } from '../store/authStore';
import { formatCurrency, todayInputValue } from '../lib/format';

interface EditableLine {
  key: string;
  productId: string;
  quantity: number;
  unitPrice: number | null;
  pricing: boolean;
}

function newLine(): EditableLine {
  return {
    key: crypto.randomUUID(),
    productId: '',
    quantity: 1,
    unitPrice: null,
    pricing: false,
  };
}

export function CreateSalesOrderPage() {
  const navigate = useNavigate();
  const role = useAuthStore((state) => state.actor?.role);
  const [customerId, setCustomerId] = useState('');
  const [shipToId, setShipToId] = useState('');
  const [requestedDate, setRequestedDate] = useState(todayInputValue());
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<EditableLine[]>([newLine()]);
  const [error, setError] = useState<unknown>(null);

  const customersQuery = useQuery({ queryKey: ['customers'], queryFn: getCustomers });
  const productsQuery = useQuery({ queryKey: ['products'], queryFn: getProducts });
  const addressesQuery = useQuery({
    queryKey: ['customer-addresses', customerId],
    queryFn: () => getCustomerAddresses(customerId),
    enabled: Boolean(customerId),
  });

  useEffect(() => {
    if (!addressesQuery.data) return;
    const addresses = addressesQuery.data.items;
    const preferred = addresses.find((address) => address.isDefault) ?? addresses[0];
    setShipToId(preferred?.id ?? '');
  }, [addressesQuery.data]);

  const products = productsQuery.data?.items ?? [];
  const total = useMemo(
    () => lines.reduce((sum, line) => sum + line.quantity * (line.unitPrice ?? 0), 0),
    [lines],
  );

  const createMutation = useMutation({
    mutationFn: createSalesOrder,
    onSuccess: (order) => navigate(`/orders/${order.id}`),
    onError: (caught) => setError(caught),
  });

  const updateLine = (key: string, patch: Partial<EditableLine>) => {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };

  const selectProduct = async (line: EditableLine, productId: string) => {
    updateLine(line.key, { productId, unitPrice: null, pricing: Boolean(productId && customerId) });
    if (!productId || !customerId) return;
    try {
      const result = await resolvePrice(customerId, productId);
      setLines((current) =>
        current.map((entry) =>
          entry.key === line.key && entry.productId === productId
            ? { ...entry, unitPrice: result.unitPrice, pricing: false }
            : entry,
        ),
      );
    } catch (caught) {
      setError(caught);
      updateLine(line.key, { pricing: false });
    }
  };

  const submit = () => {
    setError(null);
    if (!customerId || !shipToId) {
      setError(new Error('顧客と配送先を選択してください'));
      return;
    }
    const payloadLines = lines.filter((line) => line.productId);
    if (payloadLines.length === 0) {
      setError(new Error('製品を1件以上選択してください'));
      return;
    }
    if (payloadLines.some((line) => !Number.isInteger(line.quantity) || line.quantity <= 0)) {
      setError(new Error('数量は1以上の整数で入力してください'));
      return;
    }
    createMutation.mutate({
      customerId,
      shipToId,
      requestedDate: requestedDate || undefined,
      note: note || undefined,
      lines: payloadLines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
    });
  };

  if (role && role !== 'sales' && role !== 'admin') {
    return (
      <main className="page">
        <ErrorAlert error={new Error('受注登録は営業または管理者のみ実行できます')} />
        <Link to="/orders" className="btn btn-secondary">
          受注一覧へ戻る
        </Link>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="inline" style={{ justifyContent: 'space-between' }}>
        <Link to="/orders" className="btn btn-secondary btn-sm">
          ← 受注一覧へ戻る
        </Link>
      </div>
      <PageHeader
        eyebrow="NEW SALES ORDER"
        title="新規受注登録"
        description="顧客と製品を選ぶと、顧客別単価 → 標準単価の順で単価が自動入力されます。"
        showDate={false}
      />

      {error ? <ErrorAlert error={error} /> : null}
      {createMutation.isError ? <ErrorAlert error={createMutation.error} /> : null}
      {customersQuery.isLoading || productsQuery.isLoading ? <LoadingState /> : null}
      {customersQuery.isError ? <ErrorAlert error={customersQuery.error} /> : null}
      {productsQuery.isError ? <ErrorAlert error={productsQuery.error} /> : null}

      <section className="card card-pad">
        <h2 className="section-title">受注情報</h2>
        <div className="form-grid">
          <div className="field">
            <label className="required" htmlFor="customer">
              顧客
            </label>
            <select
              id="customer"
              value={customerId}
              onChange={(event) => {
                setCustomerId(event.target.value);
                setShipToId('');
              }}
            >
              <option value="">選択してください</option>
              {(customersQuery.data?.items ?? []).map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.customerCode}：{customer.clinicName}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="required" htmlFor="shipTo">
              配送先
            </label>
            <select
              id="shipTo"
              value={shipToId}
              onChange={(event) => setShipToId(event.target.value)}
              disabled={!customerId || addressesQuery.isLoading}
            >
              <option value="">
                {!customerId
                  ? '先に顧客を選択してください'
                  : addressesQuery.isLoading
                    ? '読み込み中…'
                    : '選択してください'}
              </option>
              {(addressesQuery.data?.items ?? []).map((address) => (
                <option key={address.id} value={address.id}>
                  {address.shipToName}（{address.postalCode} {address.address}）
                </option>
              ))}
            </select>
            <span className="field-hint">既定の配送先が初期選択されます。</span>
          </div>
          <div className="field">
            <label htmlFor="requestedDate">希望納期</label>
            <input
              id="requestedDate"
              type="date"
              value={requestedDate}
              onChange={(event) => setRequestedDate(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="note">備考</label>
            <input
              id="note"
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="任意"
            />
          </div>
        </div>
      </section>

      <section className="card card-pad">
        <div className="inline" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 className="section-title" style={{ marginBottom: 0 }}>
            受注明細
          </h2>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setLines((current) => [...current, newLine()])}
          >
            ＋ 明細を追加
          </button>
        </div>

        {lines.map((line, index) => (
          <div className="line-editor" key={line.key}>
            <div className="line-editor-header">
              <span className="line-editor-title">明細 {index + 1}</span>
              {lines.length > 1 ? (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => setLines((current) => current.filter((entry) => entry.key !== line.key))}
                >
                  削除
                </button>
              ) : null}
            </div>
            <div className="form-grid three">
              <div className="field span-2">
                <label className="required">製品</label>
                <select
                  value={line.productId}
                  onChange={(event) => void selectProduct(line, event.target.value)}
                >
                  <option value="">選択してください</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.productCode}：{product.productName}（{product.modelNo}）
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="required">数量</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={line.quantity}
                  onChange={(event) =>
                    updateLine(line.key, { quantity: Number(event.target.value) })
                  }
                />
              </div>
            </div>
            <div className="inline">
              <span className="subtle">確定単価（自動）</span>
              <span className="amount">
                {line.pricing
                  ? '取得中…'
                  : line.unitPrice !== null
                    ? formatCurrency(line.unitPrice, 'JPY')
                    : '—'}
              </span>
              <span className="subtle">金額</span>
              <span className="amount">
                {formatCurrency(line.quantity * (line.unitPrice ?? 0), 'JPY')}
              </span>
            </div>
          </div>
        ))}
      </section>

      <section className="card card-pad">
        <div className="inline" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="subtle">合計金額（税抜・目安）</div>
            <div className="kpi-value" style={{ fontSize: 36 }}>
              {formatCurrency(total, 'JPY')}
            </div>
            <div className="field-hint">
              確定単価は保存時にサーバーで再解決され、受注明細に固定されます。
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={createMutation.isPending}
            onClick={submit}
          >
            {createMutation.isPending ? '登録中…' : '受注を登録'}
          </button>
        </div>
      </section>
    </main>
  );
}
