import type {
  ImportApplicationEntity,
  ImportDocumentEntity,
  UpdateImportApplicationStatusInput,
} from '../domain/entities/import-application.entity';
import { normalizeImportApplicationStatus } from '../domain/entities/status-mapper';
import type {
  IImportApplicationRepository,
  ImportApplicationListParams,
} from '../domain/repositories/import-application.repository.interface';
import { toNullableNumber, toNumber, type Queryable } from './database';

interface ApplicationRow {
  id: string;
  application_no: string;
  purchase_order_id: string;
  po_no?: string;
  application_type: string;
  applied_date: string | null;
  status: string;
  confirmed_date: string | null;
  assignee_id: string | null;
  note: string | null;
  customs_broker: string | null;
  import_permit_date: string | null;
  declaration_no: string | null;
  taxable_value: string | null;
  duty_total: string | null;
  import_consumption_tax: string | null;
  customs_fee: string | null;
  other_costs: string | null;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface DocumentRow {
  id: string;
  application_id: string;
  document_name: string;
  file_path: string | null;
  submitted_date: string | null;
  is_active: boolean;
}

function mapDocument(row: DocumentRow): ImportDocumentEntity {
  return {
    id: row.id,
    applicationId: row.application_id,
    documentName: row.document_name,
    filePath: row.file_path,
    submittedDate: row.submitted_date,
    isActive: row.is_active,
  };
}

function mapApplication(
  row: ApplicationRow,
  documents: ImportDocumentEntity[],
): ImportApplicationEntity {
  return {
    id: row.id,
    applicationNo: row.application_no,
    purchaseOrderId: row.purchase_order_id,
    purchaseOrderNo: row.po_no,
    applicationType: row.application_type,
    appliedDate: row.applied_date,
    status: normalizeImportApplicationStatus(row.status),
    confirmedDate: row.confirmed_date,
    assigneeId: row.assignee_id,
    note: row.note,
    customsBroker: row.customs_broker,
    importPermitDate: row.import_permit_date,
    declarationNo: row.declaration_no,
    taxableValue: toNullableNumber(row.taxable_value),
    dutyTotal: toNullableNumber(row.duty_total),
    importConsumptionTax: toNullableNumber(row.import_consumption_tax),
    customsFee: toNullableNumber(row.customs_fee),
    otherCosts: toNullableNumber(row.other_costs),
    currency: row.currency,
    isActive: row.is_active,
    documents,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const APPLICATION_SELECT = `
  select ia.*, po.po_no
  from import_applications ia
  join purchase_orders po on po.id = ia.purchase_order_id
`;

export class PgImportApplicationRepository implements IImportApplicationRepository {
  constructor(private readonly db: Queryable) {}

  private async findDocuments(applicationId: string): Promise<ImportDocumentEntity[]> {
    const result = await this.db.query<DocumentRow>(
      `select * from import_documents
       where application_id = $1 and is_active order by created_at, id`,
      [applicationId],
    );
    return result.rows.map(mapDocument);
  }

  async findById(id: string): Promise<ImportApplicationEntity | null> {
    const result = await this.db.query<ApplicationRow>(
      `${APPLICATION_SELECT} where ia.id = $1 and ia.is_active`,
      [id],
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return mapApplication(row, await this.findDocuments(row.id));
  }

  async findByPurchaseOrderId(purchaseOrderId: string): Promise<ImportApplicationEntity | null> {
    const result = await this.db.query<{ id: string }>(
      `select id from import_applications
       where purchase_order_id = $1 and is_active order by created_at asc limit 1`,
      [purchaseOrderId],
    );
    const id = result.rows[0]?.id;
    return id ? this.findById(id) : null;
  }

  async findByApplicationNo(applicationNo: string): Promise<ImportApplicationEntity | null> {
    const result = await this.db.query<{ id: string }>(
      `select id from import_applications where application_no = $1 and is_active`,
      [applicationNo],
    );
    const id = result.rows[0]?.id;
    return id ? this.findById(id) : null;
  }

  async generateApplicationNo(date: Date): Promise<string> {
    const ymd = date.toISOString().slice(2, 10).replace(/-/g, '');
    const prefix = `ia${ymd}-`;
    await this.db.query(`select pg_advisory_xact_lock(hashtext($1))`, [prefix]);
    const result = await this.db.query<{ next: string }>(
      `select coalesce(max(substring(application_no from '[0-9]+$')::int), 0) + 1 as next
       from import_applications where application_no like $1`,
      [`${prefix}%`],
    );
    return `${prefix}${String(toNumber(result.rows[0]?.next, 1)).padStart(2, '0')}`;
  }

  async save(application: ImportApplicationEntity): Promise<void> {
    await this.db.query(
      `insert into import_applications
        (id, application_no, purchase_order_id, application_type, applied_date, status,
         confirmed_date, assignee_id, note, customs_broker, import_permit_date, declaration_no,
         taxable_value, duty_total, import_consumption_tax, customs_fee, other_costs,
         currency, is_active)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,true)`,
      [
        application.id,
        application.applicationNo,
        application.purchaseOrderId,
        application.applicationType,
        application.appliedDate,
        application.status,
        application.confirmedDate,
        application.assigneeId,
        application.note,
        application.customsBroker,
        application.importPermitDate,
        application.declarationNo,
        application.taxableValue,
        application.dutyTotal,
        application.importConsumptionTax,
        application.customsFee,
        application.otherCosts,
        application.currency,
      ],
    );
    for (const document of application.documents) {
      await this.db.query(
        `insert into import_documents
          (id, application_id, document_name, file_path, submitted_date, is_active)
         values ($1,$2,$3,$4,$5,true)`,
        [
          document.id,
          application.id,
          document.documentName,
          document.filePath,
          document.submittedDate,
        ],
      );
    }
  }

  async updateStatus(
    id: string,
    input: UpdateImportApplicationStatusInput,
    actorId?: string,
  ): Promise<void> {
    await this.db.query(
      `update import_applications set
         status = $2,
         confirmed_date = coalesce($3, confirmed_date),
         note = coalesce($4, note),
         customs_broker = coalesce($5, customs_broker),
         import_permit_date = coalesce($6, import_permit_date),
         declaration_no = coalesce($7, declaration_no),
         taxable_value = coalesce($8, taxable_value),
         duty_total = coalesce($9, duty_total),
         import_consumption_tax = coalesce($10, import_consumption_tax),
         customs_fee = coalesce($11, customs_fee),
         other_costs = coalesce($12, other_costs),
         updated_by = $13
       where id = $1`,
      [
        id,
        input.status,
        input.confirmedDate ?? null,
        input.note ?? null,
        input.customsBroker ?? null,
        input.importPermitDate ?? null,
        input.declarationNo ?? null,
        input.taxableValue ?? null,
        input.dutyTotal ?? null,
        input.importConsumptionTax ?? null,
        input.customsFee ?? null,
        input.otherCosts ?? null,
        actorId ?? null,
      ],
    );
  }

  async list(
    params: ImportApplicationListParams,
  ): Promise<{ items: ImportApplicationEntity[]; total: number }> {
    const values: unknown[] = [];
    const conditions: string[] = ['ia.is_active'];
    if (params.status) {
      values.push(params.status);
      conditions.push(`ia.status = $${values.length}`);
    }
    values.push(params.limit, params.offset);
    const limitIndex = values.length - 1;
    const offsetIndex = values.length;

    const result = await this.db.query<ApplicationRow & { total_count: string }>(
      `select ia.*, po.po_no, count(*) over() as total_count
       from import_applications ia
       join purchase_orders po on po.id = ia.purchase_order_id
       where ${conditions.join(' and ')}
       order by ia.created_at desc
       limit $${limitIndex} offset $${offsetIndex}`,
      values,
    );

    const items: ImportApplicationEntity[] = [];
    for (const row of result.rows) {
      items.push(mapApplication(row, await this.findDocuments(row.id)));
    }
    return { items, total: toNumber(result.rows[0]?.total_count) };
  }
}
