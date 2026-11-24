import type {
  MasterColumnDefinition,
  MasterTableDefinition,
  MasterTableRow,
} from '../domain/entities/master-table.entity.js';
import type {
  IMasterTableRepository,
  MasterTableRowsPage,
  MasterTableRowsQuery,
} from '../domain/repositories/master-table.repository.interface.js';
import { toNumber, type Queryable } from './database.js';

const LOOKUP_SQL: Record<string, string> = {
  customers:
    `select id, clinic_name || '（' || customer_code || '）' as label from customers where id = any($1::uuid[])`,
  customer_addresses:
    `select id, ship_to_name as label from customer_addresses where id = any($1::uuid[])`,
  suppliers:
    `select id, supplier_name || '（' || supplier_code || '）' as label from suppliers where id = any($1::uuid[])`,
  products:
    `select id, product_name || '（' || product_code || '）' as label from products where id = any($1::uuid[])`,
  sales_orders: `select id, order_no as label from sales_orders where id = any($1::uuid[])`,
  sales_order_lines: `
    select sol.id, so.order_no || ' / ' || p.product_name as label
    from sales_order_lines sol
    join sales_orders so on so.id = sol.sales_order_id
    join products p on p.id = sol.product_id
    where sol.id = any($1::uuid[])`,
  purchase_orders:
    `select id, po_no as label from purchase_orders where id = any($1::uuid[])`,
  purchase_order_lines: `
    select pol.id, po.po_no || ' / ' || p.product_name as label
    from purchase_order_lines pol
    join purchase_orders po on po.id = pol.purchase_order_id
    join products p on p.id = pol.product_id
    where pol.id = any($1::uuid[])`,
  invoices: `select id, invoice_no as label from invoices where id = any($1::uuid[])`,
  import_applications:
    `select id, application_no as label from import_applications where id = any($1::uuid[])`,
  shipments: `select id, shipment_no as label from shipments where id = any($1::uuid[])`,
  lots: `
    select l.id, l.lot_no || ' / ' || p.product_name as label
    from lots l join products p on p.id = l.product_id
    where l.id = any($1::uuid[])`,
};

function quoteIdentifier(value: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) {
    throw new Error(`Invalid SQL identifier: ${value}`);
  }
  return `"${value}"`;
}

function normalizeValue(column: MasterColumnDefinition, value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }
  switch (column.dataType) {
    case 'numeric':
    case 'integer':
      return toNumber(value);
    case 'boolean':
      return Boolean(value);
    case 'jsonb':
      return value;
    default:
      return String(value);
  }
}

export class PgMasterTableRepository implements IMasterTableRepository {
  constructor(private readonly db: Queryable) {}

  async listRows(
    definition: MasterTableDefinition,
    query: MasterTableRowsQuery,
  ): Promise<MasterTableRowsPage> {
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (query.q) {
      const searchable = definition.columns.filter((column) => column.searchable);
      if (searchable.length > 0) {
        params.push(query.q);
        const index = params.length;
        const clauses = searchable.map((column) => {
          const identifier = quoteIdentifier(column.name);
          if (column.dataType === 'text') {
            return `${identifier}::text ilike '%' || $${index} || '%'`;
          }
          return `${identifier}::text ilike $${index} || '%'`;
        });
        conditions.push(`(${clauses.join(' or ')})`);
      }
    }

    if (query.isActive !== undefined) {
      params.push(query.isActive);
      conditions.push(`${quoteIdentifier('is_active')} = $${params.length}`);
    }

    const where = conditions.length > 0 ? `where ${conditions.join(' and ')}` : '';
    const table = quoteIdentifier(definition.name);
    const countResult = await this.db.query<{ total: string }>(
      `select count(*) as total from ${table} ${where}`,
      params,
    );
    const total = toNumber(countResult.rows[0]?.total);

    const selectedColumns = definition.columns.map((column) => quoteIdentifier(column.name));
    const orderParts = [
      `${quoteIdentifier(query.sort)} ${query.order === 'asc' ? 'asc' : 'desc'}`,
    ];
    if (definition.defaultSecondarySort && query.sort === definition.defaultSort) {
      orderParts.push(
        `${quoteIdentifier(definition.defaultSecondarySort)} ${definition.defaultOrder === 'asc' ? 'asc' : 'desc'}`,
      );
    }
    if (query.sort !== 'id' && definition.columns.some((column) => column.name === 'id')) {
      orderParts.push(`${quoteIdentifier('id')} asc`);
    }

    const rowParams = [...params, query.limit, query.offset];
    const limitIndex = rowParams.length - 1;
    const offsetIndex = rowParams.length;
    const result = await this.db.query<Record<string, unknown>>(
      `select ${selectedColumns.join(', ')}
       from ${table}
       ${where}
       order by ${orderParts.join(', ')}
       limit $${limitIndex} offset $${offsetIndex}`,
      rowParams,
    );

    const items: MasterTableRow[] = result.rows.map((row) => {
      const values: Record<string, unknown> = {};
      for (const column of definition.columns) {
        values[column.name] = normalizeValue(column, row[column.name]);
      }
      return {
        id: String(row.id ?? ''),
        values,
        displayValues: {},
      };
    });

    await this.attachDisplayValues(definition, items);
    return { items, total };
  }

  async updateRow(
    definition: MasterTableDefinition,
    id: string,
    values: Record<string, unknown>,
  ): Promise<MasterTableRow | null> {
    const entries = Object.entries(values);
    if (entries.length === 0) {
      return null;
    }
    const params = entries.map(([, value]) => value);
    const assignments = entries.map(
      ([column], index) => `${quoteIdentifier(column)} = $${index + 1}`,
    );
    params.push(id);
    const selectedColumns = definition.columns.map((column) => quoteIdentifier(column.name));
    const result = await this.db.query<Record<string, unknown>>(
      `update ${quoteIdentifier(definition.name)}
       set ${assignments.join(', ')}
       where id = $${params.length}
       returning ${selectedColumns.join(', ')}`,
      params,
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    const item: MasterTableRow = {
      id: String(row.id),
      values: {},
      displayValues: {},
    };
    for (const column of definition.columns) {
      item.values[column.name] = normalizeValue(column, row[column.name]);
    }
    await this.attachDisplayValues(definition, [item]);
    return item;
  }

  private async attachDisplayValues(
    definition: MasterTableDefinition,
    items: MasterTableRow[],
  ): Promise<void> {
    if (definition.foreignKeys.length === 0 || items.length === 0) {
      return;
    }

    const idsByTarget = new Map<string, Set<string>>();
    for (const foreignKey of definition.foreignKeys) {
      const ids = idsByTarget.get(foreignKey.target) ?? new Set<string>();
      for (const item of items) {
        const value = item.values[foreignKey.column];
        if (typeof value === 'string' && value) {
          ids.add(value);
        }
      }
      if (ids.size > 0) {
        idsByTarget.set(foreignKey.target, ids);
      }
    }

    const labelsByTarget = new Map<string, Map<string, string>>();
    for (const [target, ids] of idsByTarget) {
      const sql = LOOKUP_SQL[target];
      if (!sql) {
        continue;
      }
      try {
        const result = await this.db.query<{ id: string; label: string }>(sql, [
          Array.from(ids),
        ]);
        const labels = new Map<string, string>();
        for (const row of result.rows) {
          labels.set(String(row.id), String(row.label ?? ''));
        }
        labelsByTarget.set(target, labels);
      } catch (error) {
        // 補助表示の失敗で一覧全体をエラーにしない。
        console.warn(`[master-table] lookup failed: ${target}`, error);
      }
    }

    for (const foreignKey of definition.foreignKeys) {
      const labels = labelsByTarget.get(foreignKey.target);
      if (!labels) {
        continue;
      }
      for (const item of items) {
        const value = item.values[foreignKey.column];
        if (typeof value === 'string') {
          const label = labels.get(value);
          if (label) {
            item.displayValues[foreignKey.column] = label;
          }
        }
      }
    }
  }
}
