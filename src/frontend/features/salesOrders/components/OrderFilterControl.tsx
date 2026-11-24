export interface OrderFilters {
  customer: string;
  status: string;
  orderDateFrom: string;
  orderDateTo: string;
  purchaseOrderDate: string;
  arrivalDate: string;
  receivedDate: string;
}

const STATUS_OPTIONS = ['受付', '発注済', '輸入・輸送中', '入荷済', '出荷済', '完了', '取消'];

const DATE_FILTERS: Array<{ field: keyof OrderFilters; label: string }> = [
  { field: 'purchaseOrderDate', label: '発注日' },
  { field: 'arrivalDate', label: '到着日' },
  { field: 'receivedDate', label: '入荷日' },
];

interface Props {
  values: OrderFilters;
  onChange: (field: keyof OrderFilters, value: string) => void;
  onClear: () => void;
}

export function OrderFilterControl({ values, onChange, onClear }: Props) {
  const hasFilter = Object.values(values).some(Boolean);

  return (
    <div className="order-filter-control" aria-label="受注一覧の絞り込み">
      <label className="order-filter-item order-filter-customer">
        <span>顧客</span>
        <input
          type="search"
          value={values.customer}
          onChange={(event) => onChange('customer', event.target.value)}
          placeholder="顧客名"
        />
      </label>

      <label className="order-filter-item order-filter-status">
        <span>状態</span>
        <select
          value={values.status}
          onChange={(event) => onChange('status', event.target.value)}
        >
          <option value="">すべて</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>

      <label className="order-filter-item order-filter-date-range">
        <span>受注日</span>
        <input
          type="date"
          value={values.orderDateFrom}
          max={values.orderDateTo || undefined}
          onChange={(event) => onChange('orderDateFrom', event.target.value)}
          aria-label="受注日の開始日"
        />
        <b aria-hidden="true">〜</b>
        <input
          type="date"
          value={values.orderDateTo}
          min={values.orderDateFrom || undefined}
          onChange={(event) => onChange('orderDateTo', event.target.value)}
          aria-label="受注日の終了日"
        />
      </label>

      {DATE_FILTERS.map(({ field, label }) => (
        <label key={field} className="order-filter-item order-filter-date">
          <span>{label}</span>
          <input
            type="date"
            value={values[field]}
            onChange={(event) => onChange(field, event.target.value)}
          />
        </label>
      ))}

      {hasFilter ? (
        <button type="button" className="order-filter-clear" onClick={onClear}>
          すべてクリア
        </button>
      ) : null}
    </div>
  );
}
