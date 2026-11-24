const STATUS_OPTIONS = ['すべて', '受付', '発注済', '輸入・輸送中', '出荷済', '完了'] as const;

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function StatusFilterPills({ value, onChange }: Props) {
  return (
    <div className="status-filters">
      {STATUS_OPTIONS.map((status) => {
        const isAll = status === 'すべて';
        const active = isAll ? value === '' : value === status;
        return (
          <button
            key={status}
            type="button"
            className={active ? 'filter-pill active' : 'filter-pill'}
            onClick={() => onChange(isAll ? '' : status)}
          >
            {status}
          </button>
        );
      })}
    </div>
  );
}
