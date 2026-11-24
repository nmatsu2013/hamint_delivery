import type { MasterTableDefinition, MasterTableRow } from '../entities/master-table.entity.js';

export interface MasterTableRowsQuery {
  q?: string;
  isActive?: boolean;
  sort: string;
  order: 'asc' | 'desc';
  limit: number;
  offset: number;
}

export interface MasterTableRowsPage {
  items: MasterTableRow[];
  total: number;
}

export interface IMasterTableRepository {
  listRows(
    definition: MasterTableDefinition,
    query: MasterTableRowsQuery,
  ): Promise<MasterTableRowsPage>;
  updateRow(
    definition: MasterTableDefinition,
    id: string,
    values: Record<string, unknown>,
  ): Promise<MasterTableRow | null>;
}
