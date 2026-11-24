import { useEffect, useRef } from 'react';
import type { MasterTableColumn, MasterTableRow } from '../types/masterTable';
import { formatJson, formatMasterValue, representativeValue } from '../utils/format';
import { CopyButton } from './CopyButton';

interface Props {
  open: boolean;
  tableLabel: string;
  row: MasterTableRow | null;
  columns: MasterTableColumn[];
  onClose: () => void;
}

export function MasterRecordDrawer({ open, tableLabel, row, columns, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [open, onClose]);

  if (!open || !row) {
    return null;
  }

  const normalColumns = columns.filter(
    (column) => column.name !== 'old_data' && column.name !== 'new_data',
  );
  const oldData = row.values.old_data;
  const newData = row.values.new_data;

  return (
    <div
      className="master-drawer-overlay"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <aside
        className="master-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="master-drawer-title"
      >
        <div className="master-drawer-header">
          <div>
            <h2 id="master-drawer-title">{tableLabel}の詳細</h2>
            <p>{representativeValue(row)}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="master-drawer-close"
            onClick={onClose}
            aria-label="詳細を閉じる"
          >
            ×
          </button>
        </div>
        <div className="master-drawer-body">
          <table className="master-drawer-table">
            <thead>
              <tr>
                <th scope="col">項目</th>
                <th scope="col">物理名</th>
                <th scope="col">値</th>
              </tr>
            </thead>
            <tbody>
              {normalColumns.map((column) => (
                <tr key={column.name}>
                  <th scope="row">{column.label}</th>
                  <td>
                    <code>{column.name}</code>
                  </td>
                  <td>{renderDrawerValue(column, row)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {oldData !== undefined && oldData !== null ? (
            <JsonBlock title="変更前" value={oldData} />
          ) : null}
          {newData !== undefined && newData !== null ? (
            <JsonBlock title="変更後" value={newData} />
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function renderDrawerValue(column: MasterTableColumn, row: MasterTableRow) {
  const value = row.values[column.name];
  const display = row.displayValues[column.name];
  if (column.dataType === 'jsonb') {
    return <pre className="master-json-block">{formatJson(value)}</pre>;
  }
  if (column.dataType === 'uuid' && value !== null && value !== undefined) {
    return (
      <div className="master-drawer-uuid">
        {display ? <div className="master-fk-ref">{display}</div> : null}
        <code>{String(value)}</code>
        <CopyButton value={String(value)} />
      </div>
    );
  }
  const formatted = formatMasterValue(column, value, row.values);
  return (
    <span
      className={
        formatted.kind === 'null'
          ? 'master-null'
          : formatted.kind === 'empty'
            ? 'master-empty'
            : undefined
      }
    >
      {formatted.text}
    </span>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <section className="master-json-section">
      <h3>{title}</h3>
      <pre className="master-json-block">{formatJson(value)}</pre>
    </section>
  );
}
