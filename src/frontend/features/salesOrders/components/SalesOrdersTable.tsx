import { useNavigate } from 'react-router-dom';
import { StatusPill } from '../../../components/elements/StatusPill';
import { EmptyState } from '../../../components/elements/StateViews';
import { DESIGN_TOKENS } from '../../../lib/designTokens';
import { formatCurrency, formatNumber, formatShortDate } from '../../../lib/format';
import type { SalesOrderSummary } from '../../../types/api';

const PROGRESS_BY_STATUS: Record<string, number> = {
  受付: 1,
  発注済: 2,
  '輸入・輸送中': 4,
  入荷済: 5,
  出荷済: 6,
  完了: 8,
  取消: 0,
};

function progressOf(status: string): number {
  return PROGRESS_BY_STATUS[status] ?? 1;
}

export function SalesOrdersTable({ items }: { items: SalesOrderSummary[] }) {
  const navigate = useNavigate();
  if (items.length === 0) {
    return <EmptyState label="条件に一致する受注がありません" />;
  }
  return (
    <div className="table-wrap">
      <table className="data-table orders-table">
        <thead>
          <tr>
            <th>受注日</th>
            <th>受注番号</th>
            <th>状態</th>
            <th>進み具合</th>
            <th>顧客</th>
            <th>配送先</th>
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
          {items.map((item) => {
            const progress = progressOf(item.status);
            return (
              <tr key={item.id}>
                <td className="nowrap">{formatShortDate(item.orderDate)}</td>
                <td className="mono">{item.orderNo}</td>
                <td>
                  <StatusPill status={item.status} />
                </td>
                <td>
                  <div
                    className="progress-bars"
                    role="img"
                    aria-label={`進み具合 ${progress}/8`}
                  >
                    {Array.from({ length: 8 }, (_, index) => (
                      <span
                        key={index}
                        className={
                          index < progress
                            ? `progress-seg filled seg-${index}`
                            : `progress-seg seg-${index}`
                        }
                        style={
                          index < progress
                            ? { backgroundColor: DESIGN_TOKENS.progressStepColors[index] }
                            : undefined
                        }
                      />
                    ))}
                    <span
                      className="progress-label"
                      style={{
                        fontWeight: progress > 0 ? 700 : 400,
                        color:
                          progress > 0
                            ? (DESIGN_TOKENS.progressStepTextColors?.[progress - 1] ??
                              DESIGN_TOKENS.progressStepColors[progress - 1])
                            : '#5B6B80',
                      }}
                    >
                      {progress}/8
                    </span>
                  </div>
                </td>
                <td className="clinic-name nowrap">{item.customerName}</td>
                <td className="nowrap">{item.shipToName}</td>
                <td className="nowrap">
                  {item.mainProductName}
                  {item.lineCount > 1 ? ` ほか${item.lineCount - 1}点` : ''}
                </td>
                <td className="align-right nowrap">{formatNumber(item.quantity)}</td>
                <td className="align-right amount nowrap">
                  {formatCurrency(item.totalAmount, item.currency)}
                </td>
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
                    className="btn-open"
                    onClick={() => navigate(`/orders/${item.id}`)}
                  >
                    開く ↗
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
