import type { MouseEvent } from 'react';
import type {
  MasterTableColumn,
  MasterTableRow,
  MasterTableRowsResponse,
} from '../types/masterTable';
import { formatMasterValue } from '../utils/format';
import { CopyButton } from './CopyButton';

interface Props {
  data: MasterTableRowsResponse;
  sort?: string;
  order?: 'asc' | 'desc';
  onSort: (column: string) => void;
  onOpen: (row: MasterTableRow) => void;
  onEdit: (row: MasterTableRow) => void;
}

export function MasterDataGrid({ data, sort, order, onSort, onOpen, onEdit }: Props) {
  const columns = data.columns.filter((column) => column.visible);

  const handleRowClick = (event: MouseEvent<HTMLTableRowElement>, row: MasterTableRow) => {
    const target = event.target as HTMLElement;
    if (target.closest('button, a, input, select, textarea')) {
      return;
    }
    if (window.getSelection()?.toString()) {
      return;
    }
    event.currentTarget.focus({ preventScroll: true });
    onOpen(row);
  };

  return (
    <div className="master-table-scroll">
      <table className="master-table">
        <caption className="sr-only">{data.table.label}の一覧</caption>
        <thead>
          <tr>
            <th scope="col" className="master-action-th">
              操作
            </th>
            {columns.map((column) => {
              const ariaSort =
                sort === column.name
                  ? order === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none';
              return (
                <th key={column.name} scope="col" aria-sort={ariaSort}>
                  {column.sortable ? (
                    <button
                      type="button"
                      className="master-sort-button"
                      onClick={() => onSort(column.name)}
                      title={`${column.label}で並び替え`}
                    >
                      <span>{column.label}</span>
                      <span className="master-sort-arrow" aria-hidden="true">
                        {sort === column.name ? (order === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {data.items.map((row) => (
            <tr
              key={row.id}
              tabIndex={0}
              onClick={(event) => handleRowClick(event, row)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onOpen(row);
                }
              }}
            >
              <td className="master-action-td">
                <div className="master-row-actions">
                <button
                  type="button"
                  className="master-detail-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    event.currentTarget.focus({ preventScroll: true });
                    onOpen(row);
                  }}
                >
                  詳細
                </button>
                <button
                  type="button"
                  className="master-edit-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onEdit(row);
                  }}
                >
                  編集
                </button>
                </div>
              </td>
              {columns.map((column) => (
                <td key={column.name}>{renderCell(column, row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderCell(column: MasterTableColumn, row: MasterTableRow) {
  const value = row.values[column.name];
  const display = row.displayValues[column.name];
  const formatted = formatMasterValue(column, value, row.values);

  if (formatted.kind === 'uuid') {
    const full = formatted.fullText ?? '';
    return (
      <div className="master-uuid-cell">
        {display ? <div className="master-fk-ref">{display}</div> : null}
        <div className="master-uuid-line">
          <code title={full}>{full.slice(0, 8)}</code>
          <CopyButton value={full} />
        </div>
      </div>
    );
  }
  if (formatted.kind === 'json') {
    return <span className="master-json-badge">JSON</span>;
  }
  if (formatted.kind === 'null') {
    return <span className="master-null">—</span>;
  }
  if (formatted.kind === 'empty') {
    return <span className="master-empty">（空）</span>;
  }
  return (
    <span className="master-cell-ellipsis" title={formatted.fullText ?? formatted.text}>
      {formatted.text}
    </span>
  );
}
