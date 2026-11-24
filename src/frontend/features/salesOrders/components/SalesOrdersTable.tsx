import { useNavigate } from 'react-router-dom';
import { StatusPill } from '../../../components/elements/StatusPill';
import { EmptyState } from '../../../components/elements/StateViews';
import { DESIGN_TOKENS } from '../../../lib/designTokens';
import {
  formatCurrency,
  formatNumber,
  formatShortDate,
} from '../../../lib/format';
import type { SalesOrderSummary } from '../../../types/api';

export function SalesOrdersTable({ items }: { items: SalesOrderSummary[] }) {
  const navigate = useNavigate();
  if (items.length === 0) {
    return <EmptyState label="条件に一致する受注がありません" />;
  }
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>受注日</th>
            <th>状態</th>
            <th>受注番号</th>
            <th>顧客（配送先）</th>
            <th>主な製品</th>
            <th className="align-right">数量</th>
            <th className="align-right">金額（税抜）</th>
            <th>希望納期</th>
            <th>入金</th>
            <th>
              <span style={{ position: 'absolute', left: -9999 }}>操作</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td className="nowrap" style={{ fontWeight: 700 }}>
                {formatShortDate(item.orderDate)}
              </td>
              <td>
                <StatusPill status={item.status} />
              </td>
              <td className="mono">{item.orderNo}</td>
              <td>
                <div className="clinic-name">{item.customerName}</div>
                <div className="subtle">{item.shipToName}</div>
              </td>
              <td>
                {item.mainProductName}
                {item.lineCount > 1 ? ` ほか${item.lineCount - 1}点` : ''}
              </td>
              <td className="align-right nowrap">{formatNumber(item.quantity)}</td>
              <td className="align-right amount">{formatCurrency(item.totalAmount, item.currency)}</td>
              <td className="nowrap">{formatShortDate(item.requestedDate)}</td>
              <td
                className="nowrap"
                style={{
                  fontWeight: 700,
                  color: DESIGN_TOKENS.paymentStatusColors[item.paymentStatus] ?? '#5B6B80',
                }}
              >
                {item.paymentStatus}
              </td>
              <td className="align-right">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => navigate(`/orders/${item.id}`)}
                >
                  明細を開く ↗
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
