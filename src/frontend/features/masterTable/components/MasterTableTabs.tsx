import type { MasterTableSummary } from '../types/masterTable';

interface Props {
  tables: MasterTableSummary[];
  selectedName: string;
  onChange: (tableName: string) => void;
}

export function MasterTableTabs({ tables, selectedName, onChange }: Props) {
  return (
    <div className="master-tabs" role="tablist" aria-label="マスタテーブル">
      {tables.map((table) => (
        <button
          key={table.name}
          type="button"
          role="tab"
          aria-selected={table.name === selectedName}
          className={table.name === selectedName ? 'master-tab active' : 'master-tab'}
          onClick={() => onChange(table.name)}
        >
          {table.label}
        </button>
      ))}
    </div>
  );
}
