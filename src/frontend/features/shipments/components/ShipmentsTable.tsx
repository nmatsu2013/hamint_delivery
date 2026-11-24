import { useState } from 'react';
import { StatusPill } from '../../../components/elements/StatusPill';
import { formatDate, formatNumber, todayInputValue } from '../../../lib/format';
import type { ShipmentSummary } from '../../../types/api';

interface Props {
  items: ShipmentSummary[];
  onDeliver: (id: string, deliveredDate: string) => void;
  delivering: boolean;
}

export function ShipmentsTable({ items, onDeliver, delivering }: Props) {
  if (items.length === 0) {
    return <div className="empty-state">配送はまだありません</div>;
  }
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>区分</th>
            <th>出荷番号</th>
            <th>受注 / 発注</th>
            <th>状態</th>
            <th>発送日</th>
            <th>納品日</th>
            <th>配送業者</th>
            <th>追跡番号</th>
            <th className="align-right">数量</th>
            <th>納品登録</th>
          </tr>
        </thead>
        <tbody>
          {items.map((shipment) => (
            <tr key={shipment.id}>
              <td>{shipment.directionLabel}</td>
              <td className="mono">{shipment.shipmentNo}</td>
              <td className="mono">{shipment.orderNo ?? shipment.poNo ?? '—'}</td>
              <td>
                <StatusPill status={shipment.status} />
              </td>
              <td className="nowrap">{formatDate(shipment.shippedDate)}</td>
              <td className="nowrap">{formatDate(shipment.deliveredDate)}</td>
              <td>{shipment.carrier ?? '—'}</td>
              <td className="mono">{shipment.trackingNo ?? '—'}</td>
              <td className="align-right">{formatNumber(shipment.totalQuantity)}</td>
              <td>
                {shipment.deliveredDate ? (
                  <span className="subtle">納品済</span>
                ) : (
                  <DeliverControl shipment={shipment} onDeliver={onDeliver} delivering={delivering} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeliverControl({
  shipment,
  onDeliver,
  delivering,
}: {
  shipment: ShipmentSummary;
  onDeliver: (id: string, deliveredDate: string) => void;
  delivering: boolean;
}) {
  const [date, setDate] = useState(todayInputValue());
  return (
    <div className="inline" style={{ gap: 6 }}>
      <input
        type="date"
        value={date}
        onChange={(event) => setDate(event.target.value)}
        style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #cbd6e2' }}
        aria-label={`${shipment.shipmentNo} の納品日`}
      />
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={delivering || !date}
        onClick={() => onDeliver(shipment.id, date)}
      >
        納品
      </button>
    </div>
  );
}
