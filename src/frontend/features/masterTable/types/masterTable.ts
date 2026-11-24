export type MasterTableCategory = 'master' | 'transaction' | 'audit';

export type MasterColumnDataType =
  | 'text'
  | 'uuid'
  | 'numeric'
  | 'integer'
  | 'date'
  | 'timestamptz'
  | 'boolean'
  | 'jsonb';

export interface MasterTableSummary {
  name: string;
  label: string;
  category: MasterTableCategory;
  description: string;
  hasActiveFlag: boolean;
  defaultSort: string;
  defaultOrder: 'asc' | 'desc';
}

export interface MasterTableColumn {
  name: string;
  label: string;
  dataType: MasterColumnDataType;
  sortable: boolean;
  visible: boolean;
  editable: boolean;
  required: boolean;
  foreignKeyTarget?: string;
}

export interface MasterTableRow {
  id: string;
  values: Record<string, unknown>;
  displayValues: Record<string, string>;
}

export interface MasterTableRowsResponse {
  table: {
    name: string;
    label: string;
    description: string;
  };
  columns: MasterTableColumn[];
  items: MasterTableRow[];
  total: number;
  limit: number;
  offset: number;
}

export interface MasterRowsParams {
  q?: string;
  isActive?: boolean;
  sort?: string;
  order?: 'asc' | 'desc';
  limit: number;
  offset: number;
}

export interface MasterTableUpdateResponse {
  item: MasterTableRow;
}
