import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../components/elements/PageHeader';
import { ErrorAlert, LoadingState } from '../components/elements/StateViews';
import { getCustomers, getProducts } from '../features/master/api/masterApi';
import { useAuthStore } from '../store/authStore';
import { formatNumber } from '../lib/format';

export function MasterPage() {
  const role = useAuthStore((state) => state.actor?.role);
  const canViewCustomers = role === 'sales' || role === 'admin';
  const [tab, setTab] = useState<'products' | 'customers'>(
    canViewCustomers ? 'customers' : 'products',
  );

  const customersQuery = useQuery({
    queryKey: ['customers'],
    queryFn: getCustomers,
    enabled: canViewCustomers,
  });
  const productsQuery = useQuery({ queryKey: ['products'], queryFn: getProducts });

  return (
    <main className="page">
      <PageHeader
        eyebrow="MASTER DATA"
        title="顧客・製品マスタ"
        description="受注・発注で利用する顧客（クリニック・配送先）と製品の参照画面です。"
        showDate={false}
      />

      <div className="tabs">
        {canViewCustomers ? (
          <button
            type="button"
            className={tab === 'customers' ? 'tab active' : 'tab'}
            onClick={() => setTab('customers')}
          >
            顧客
          </button>
        ) : null}
        <button
          type="button"
          className={tab === 'products' ? 'tab active' : 'tab'}
          onClick={() => setTab('products')}
        >
          製品
        </button>
      </div>

      {tab === 'customers' ? (
        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">顧客一覧</h2>
              <p className="card-subtitle">請求先住所・締日・支払条件</p>
            </div>
          </div>
          {customersQuery.isLoading ? <LoadingState /> : null}
          {customersQuery.isError ? (
            <div className="card-pad">
              <ErrorAlert error={customersQuery.error} />
            </div>
          ) : null}
          {customersQuery.data ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>コード</th>
                    <th>クリニック名</th>
                    <th>カナ</th>
                    <th>住所</th>
                    <th>電話</th>
                    <th className="align-right">締日</th>
                    <th>支払条件</th>
                  </tr>
                </thead>
                <tbody>
                  {customersQuery.data.items.map((customer) => (
                    <tr key={customer.id}>
                      <td className="mono">{customer.customerCode}</td>
                      <td>
                        <div className="clinic-name">{customer.clinicName}</div>
                      </td>
                      <td>{customer.clinicNameKana ?? '—'}</td>
                      <td className="subtle">
                        〒{customer.postalCode} {customer.address}
                      </td>
                      <td className="nowrap">{customer.tel ?? '—'}</td>
                      <td className="align-right">{customer.closingDay ?? '—'}</td>
                      <td>{customer.paymentTerms ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : (
        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">製品一覧</h2>
              <p className="card-subtitle">有効な製品のみ表示します</p>
            </div>
          </div>
          {productsQuery.isLoading ? <LoadingState /> : null}
          {productsQuery.isError ? (
            <div className="card-pad">
              <ErrorAlert error={productsQuery.error} />
            </div>
          ) : null}
          {productsQuery.data ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>コード</th>
                    <th>製品名</th>
                    <th>型番</th>
                    <th>カテゴリ</th>
                    <th>素材</th>
                    <th>規格メモ</th>
                    <th>用途</th>
                    <th>主力区分</th>
                    <th className="align-right">入数</th>
                  </tr>
                </thead>
                <tbody>
                  {productsQuery.data.items.map((product) => (
                    <tr key={product.id}>
                      <td className="mono">{product.productCode}</td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{product.productName}</div>
                      </td>
                      <td className="mono">{product.modelNo}</td>
                      <td>{product.category ?? '—'}</td>
                      <td>{product.material ?? '—'}</td>
                      <td className="subtle">{product.specNote ?? '—'}</td>
                      <td className="subtle">{product.usage ?? '—'}</td>
                      <td>{product.priorityClass ?? '—'}</td>
                      <td className="align-right">
                        {formatNumber(product.packQty)} {product.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      )}
    </main>
  );
}
