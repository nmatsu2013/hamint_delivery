import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import type { MasterTableColumn, MasterTableRow } from '../types/masterTable';
import { representativeValue } from '../utils/format';

interface Props {
  open: boolean;
  tableLabel: string;
  row: MasterTableRow | null;
  columns: MasterTableColumn[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (values: Record<string, unknown>) => void;
}

const MULTILINE_COLUMNS = new Set([
  'address',
  'note',
  'license_info',
  'delivery_note',
  'regulatory_info',
  'storage_condition',
  'spec_note',
  'usage',
]);

export function MasterEditDrawer({
  open,
  tableLabel,
  row,
  columns,
  saving,
  error,
  onClose,
  onSave,
}: Props) {
  const editableColumns = useMemo(
    () => columns.filter((column) => column.editable),
    [columns],
  );
  const [values, setValues] = useState<Record<string, unknown>>({});
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open || !row) return;
    const initial: Record<string, unknown> = {};
    for (const column of editableColumns) {
      initial[column.name] = row.values[column.name] ?? (column.dataType === 'boolean' ? false : '');
    }
    setValues(initial);
  }, [open, row, editableColumns]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [open, saving, onClose]);

  if (!open || !row) return null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSave(values);
  };

  return (
    <div
      className="master-drawer-overlay"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <aside className="master-drawer master-edit-drawer" role="dialog" aria-modal="true">
        <div className="master-drawer-header">
          <div>
            <h2>{tableLabel}を編集</h2>
            <p>{representativeValue(row)}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="master-drawer-close"
            disabled={saving}
            onClick={onClose}
            aria-label="編集を閉じる"
          >
            ×
          </button>
        </div>
        <form className="master-edit-form" onSubmit={submit}>
          <div className="master-edit-fields">
            {editableColumns.map((column) => (
              <EditField
                key={column.name}
                column={column}
                value={values[column.name]}
                referenceLabel={row.displayValues[column.name]}
                disabled={saving}
                onChange={(value) => setValues((current) => ({ ...current, [column.name]: value }))}
              />
            ))}
          </div>
          {error ? <div className="master-edit-error" role="alert">{error}</div> : null}
          <div className="master-edit-actions">
            <button type="button" className="master-cancel-button" disabled={saving} onClick={onClose}>
              キャンセル
            </button>
            <button type="submit" className="master-save-button" disabled={saving}>
              {saving ? '保存中…' : '変更を保存'}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}

function EditField({
  column,
  value,
  referenceLabel,
  disabled,
  onChange,
}: {
  column: MasterTableColumn;
  value: unknown;
  referenceLabel?: string;
  disabled: boolean;
  onChange: (value: unknown) => void;
}) {
  const id = `master-edit-${column.name}`;
  if (column.dataType === 'boolean') {
    return (
      <label className="master-edit-checkbox" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={Boolean(value)}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>{column.label}</span>
        <code>{column.name}</code>
      </label>
    );
  }

  const common = {
    id,
    value: value === null || value === undefined ? '' : String(value),
    required: column.required,
    disabled,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(event.target.value),
  };
  return (
    <label className="master-edit-field" htmlFor={id}>
      <span>
        {column.label}{column.required ? <b>必須</b> : null}
      </span>
      <code>{column.name}</code>
      {referenceLabel ? <small>現在の参照先：{referenceLabel}</small> : null}
      {MULTILINE_COLUMNS.has(column.name) ? (
        <textarea {...common} rows={3} />
      ) : (
        <input
          {...common}
          type={inputType(column)}
          step={column.dataType === 'integer' ? 1 : column.dataType === 'numeric' ? 'any' : undefined}
        />
      )}
    </label>
  );
}

function inputType(column: MasterTableColumn): 'text' | 'number' | 'date' | 'email' {
  if (column.dataType === 'integer' || column.dataType === 'numeric') return 'number';
  if (column.dataType === 'date') return 'date';
  if (column.name === 'email') return 'email';
  return 'text';
}
