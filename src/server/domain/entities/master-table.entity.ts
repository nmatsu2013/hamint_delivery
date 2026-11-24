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

export interface MasterColumnDefinition {
  name: string;
  label: string;
  dataType: MasterColumnDataType;
  sortable: boolean;
  visible: boolean;
  searchable: boolean;
  editable: boolean;
  required: boolean;
  foreignKeyTarget?: string;
}

export interface MasterForeignKeyDefinition {
  column: string;
  target: string;
}

export interface MasterTableDefinition {
  name: string;
  label: string;
  category: MasterTableCategory;
  description: string;
  hasActiveFlag: boolean;
  defaultSort: string;
  defaultOrder: 'asc' | 'desc';
  defaultSecondarySort?: string;
  columns: MasterColumnDefinition[];
  foreignKeys: MasterForeignKeyDefinition[];
}

export interface MasterTableSummary {
  name: string;
  label: string;
  category: MasterTableCategory;
  description: string;
  hasActiveFlag: boolean;
  defaultSort: string;
  defaultOrder: 'asc' | 'desc';
}

export interface MasterTablePublicColumn {
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

export interface MasterTableRowsResult {
  table: {
    name: string;
    label: string;
    description: string;
  };
  columns: MasterTablePublicColumn[];
  items: MasterTableRow[];
  total: number;
  limit: number;
  offset: number;
}

export interface MasterTableUpdateResult {
  item: MasterTableRow;
}
