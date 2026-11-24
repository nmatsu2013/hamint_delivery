import type { MasterTableColumn, MasterTableRow } from '../types/masterTable';

export interface FormattedCell {
  kind: 'text' | 'null' | 'empty' | 'uuid' | 'json' | 'date' | 'datetime';
  text: string;
  fullText?: string;
}

export function formatMasterValue(
  column: MasterTableColumn,
  value: unknown,
  row: Record<string, unknown>,
): FormattedCell {
  if (value === null || value === undefined) {
    return { kind: 'null', text: '—' };
  }
  if (value === '') {
    return { kind: 'empty', text: '（空）' };
  }

  switch (column.dataType) {
    case 'boolean':
      return {
        kind: 'text',
        text:
          column.name === 'is_active'
            ? value
              ? '有効'
              : '無効'
            : value
              ? 'はい'
              : 'いいえ',
      };
    case 'jsonb':
      return { kind: 'json', text: 'JSON' };
    case 'uuid': {
      const fullText = String(value);
      return { kind: 'uuid', text: fullText.slice(0, 8), fullText };
    }
    case 'date':
      return { kind: 'date', text: String(value).replace(/-/g, '/') };
    case 'timestamptz':
      return { kind: 'datetime', text: formatTokyoDateTime(String(value)) };
    case 'numeric':
    case 'integer': {
      const number = Number(value);
      if (Number.isNaN(number)) {
        return { kind: 'text', text: String(value) };
      }
      return {
        kind: 'text',
        text: `${number.toLocaleString('ja-JP')}${currencySuffix(column.name, row)}`,
      };
    }
    default:
      return { kind: 'text', text: String(value), fullText: String(value) };
  }
}

function currencySuffix(columnName: string, row: Record<string, unknown>): string {
  if (!/amount|cost|price|fee|value|total|duty/.test(columnName)) {
    return '';
  }
  const currency =
    columnName.startsWith('duty_')
      ? row.duty_currency
      : columnName.startsWith('fee')
        ? row.fee_currency
        : row.currency;
  return currency ? ` ${String(currency)}` : '';
}

function formatTokyoDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}/${get('month')}/${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

export function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function representativeValue(row: MasterTableRow): string {
  const candidates = ['order_no', 'po_no', 'invoice_no', 'application_no', 'shipment_no', 'lot_no'];
  for (const key of candidates) {
    const value = row.values[key];
    if (value !== null && value !== undefined && value !== '') {
      return String(value);
    }
  }
  return row.id;
}
