import type { MasterTableSummary } from '../types/masterTable';

interface Props {
  selected: MasterTableSummary | null;
  q: string;
  isActive: boolean | undefined;
  limit: number;
  refreshing: boolean;
  disabled?: boolean;
  onQChange: (value: string) => void;
  onIsActiveChange: (value: boolean | undefined) => void;
  onLimitChange: (value: number) => void;
  onReset: () => void;
}

export function MasterTableToolbar({
  selected,
  q,
  isActive,
  limit,
  refreshing,
  disabled = false,
  onQChange,
  onIsActiveChange,
  onLimitChange,
  onReset,
}: Props) {
  return (
    <div className="master-toolbar">
      <div className="master-toolbar-group">
        <label className="master-field master-search-field">
          <span>検索</span>
          <input
            className="master-input"
            type="search"
            value={q}
            placeholder="このテーブルを検索"
            disabled={disabled}
            onChange={(event) => onQChange(event.target.value)}
          />
        </label>
        {selected?.hasActiveFlag ? (
          <label className="master-field">
            <span>有効状態</span>
            <select
              className="master-select"
              value={isActive === undefined ? 'all' : String(isActive)}
              disabled={disabled}
              onChange={(event) =>
                onIsActiveChange(
                  event.target.value === 'all' ? undefined : event.target.value === 'true',
                )
              }
            >
              <option value="all">すべて</option>
              <option value="true">有効</option>
              <option value="false">無効</option>
            </select>
          </label>
        ) : null}
        <label className="master-field">
          <span>1ページ件数</span>
          <select
            className="master-select"
            value={limit}
            disabled={disabled}
            onChange={(event) => onLimitChange(Number(event.target.value))}
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
        <button
          type="button"
          className="master-reset-button"
          disabled={disabled}
          onClick={onReset}
        >
          リセット
        </button>
        {refreshing ? <span className="master-refreshing">読み込み中…</span> : null}
      </div>
    </div>
  );
}
