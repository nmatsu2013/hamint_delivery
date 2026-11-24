import type {
  ImportApplicationEntity,
  UpdateImportApplicationStatusInput,
} from '../entities/import-application.entity.js';

export interface ImportApplicationListParams {
  status?: string;
  limit: number;
  offset: number;
}

export interface IImportApplicationRepository {
  findById(id: string): Promise<ImportApplicationEntity | null>;
  findByPurchaseOrderId(purchaseOrderId: string): Promise<ImportApplicationEntity | null>;
  findByApplicationNo(applicationNo: string): Promise<ImportApplicationEntity | null>;
  generateApplicationNo(date: Date): Promise<string>;
  save(application: ImportApplicationEntity): Promise<void>;
  updateStatus(id: string, input: UpdateImportApplicationStatusInput, actorId?: string): Promise<void>;
  list(
    params: ImportApplicationListParams,
  ): Promise<{ items: ImportApplicationEntity[]; total: number }>;
}
