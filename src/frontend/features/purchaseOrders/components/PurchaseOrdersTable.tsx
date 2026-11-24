import { StatusPill } from '../../../components/elements/StatusPill';
import { formatCurrency, formatDate, formatNumber } from '../../../lib/format';
import type { PurchaseOrderSummary } from '../../../types/api';

export function PurchaseOrdersTable({
  items,
  showAmount,
}: {
  items: PurchaseOrderSummary[];
  showAmount: boolean;
}) {
  if (items.length === 0) {
    return <div className="empty-state">発注はまだありません</div>;
  }
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>発注番号</th>
            <th>仕入先</th>
            <th>発注日</th>
            <th>納期回答</th>
            <th>状態</th>
            <th className="align-right">明細</th>
            <th className="align-right">数量</th>
            {showAmount ? <th className="align-right">金額</th> : null}
          </tr>
        </thead>
        <tbody>
          {items.map((po) => (
            <tr key={po.id}>
              <td className="mono">{po.poNo}</td>
              <td>{po.supplierName}</td>
              <td className="nowrap">{formatDate(po.orderedDate)}</td>
              <td className="nowrap">{formatDate(po.promisedDate)}</td>
              <td>
                <StatusPill status={po.status} />
              </td>
              <td className="align-right">{formatNumber(po.lineCount)}</td>
              <td className="align-right">{formatNumber(po.totalQuantity)}</td>
              {showAmount ? (
                <td className="align-right amount">
                  {formatCurrency(po.totalAmount, po.currency)}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
