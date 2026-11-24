import { randomUUID } from 'node:crypto';
import {
  BusinessRuleViolationError,
  ValidationError,
} from '../domain/errors/domain.error';
import type { Actor } from '../domain/entities/actor.entity';
import type {
  CreateImportApplicationInput,
  ImportApplicationEntity,
  UpdateImportApplicationStatusInput,
} from '../domain/entities/import-application.entity';
import { IMPORT_APPLICATION_STATUS } from '../domain/entities/status';
import { normalizeImportApplicationStatus } from '../domain/entities/status-mapper';
import type { IUnitOfWork } from '../domain/repositories/unit-of-work.interface';
import { clampPageSize, parseOffset } from '../config/constants';
import { dateStringToUtcDate, isValidDateString, todayInTokyo } from '../config/date';
import { ensureFound } from './service-support';

export interface ImportApplicationListQuery {
  status?: string;
  limit?: number;
  offset?: number;
}

export class ImportApplicationService {
  constructor(private readonly uow: IUnitOfWork) {}

  async list(query: ImportApplicationListQuery) {
    const limit = clampPageSize(query.limit);
    const offset = parseOffset(query.offset);
    const status = query.status ? normalizeImportApplicationStatus(query.status) : undefined;
    const result = await this.uow.repos.importApplications.list({ status, limit, offset });
    return { ...result, limit, offset };
  }

  async getDetail(id: string): Promise<ImportApplicationEntity> {
    return ensureFound(await this.uow.repos.importApplications.findById(id), '輸入申請', id);
  }

  async create(
    input: CreateImportApplicationInput,
    actor: Actor,
  ): Promise<ImportApplicationEntity> {
    if (input.appliedDate && !isValidDateString(input.appliedDate)) {
      throw new ValidationError('申請日の形式が不正です');
    }
    return this.uow.run(async (repos) => {
      ensureFound(
        await repos.purchaseOrders.findById(input.purchaseOrderId),
        '発注',
        input.purchaseOrderId,
      );
      const existing = await repos.importApplications.findByPurchaseOrderId(
        input.purchaseOrderId,
      );
      if (existing) {
        throw new BusinessRuleViolationError(
          `発注には既に輸入申請 ${existing.applicationNo} が存在します`,
        );
      }
      const applicationId = randomUUID();
      const documents = (
        input.documents ?? [
          { documentName: 'インボイス', submittedDate: input.appliedDate },
          { documentName: 'パッキングリスト', submittedDate: input.appliedDate },
        ]
      ).map((document) => ({
        id: randomUUID(),
        applicationId,
        documentName: document.documentName,
        filePath: document.filePath ?? null,
        submittedDate: document.submittedDate ?? null,
        isActive: true,
      }));
      const application: ImportApplicationEntity = {
        id: applicationId,
        applicationNo: await repos.importApplications.generateApplicationNo(
          dateStringToUtcDate(input.appliedDate ?? todayInTokyo()),
        ),
        purchaseOrderId: input.purchaseOrderId,
        applicationType: input.applicationType ?? '輸入申請（種別は要確認）',
        appliedDate: input.appliedDate ?? null,
        status: input.appliedDate
          ? IMPORT_APPLICATION_STATUS.APPLIED
          : IMPORT_APPLICATION_STATUS.PREPARING,
        confirmedDate: null,
        assigneeId: input.assigneeId ?? actor.id,
        note: input.note ?? null,
        customsBroker: input.customsBroker ?? null,
        importPermitDate: null,
        declarationNo: null,
        taxableValue: null,
        dutyTotal: null,
        importConsumptionTax: null,
        customsFee: null,
        otherCosts: null,
        currency: 'JPY',
        isActive: true,
        documents,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await repos.importApplications.save(application);
      return ensureFound(
        await repos.importApplications.findById(applicationId),
        '輸入申請',
        applicationId,
      );
    }, actor);
  }

  async updateStatus(
    id: string,
    input: UpdateImportApplicationStatusInput,
    actor: Actor,
  ): Promise<ImportApplicationEntity> {
    const status = normalizeImportApplicationStatus(input.status);
    if (input.confirmedDate && !isValidDateString(input.confirmedDate)) {
      throw new ValidationError('確認完了日の形式が不正です');
    }
    if (input.importPermitDate && !isValidDateString(input.importPermitDate)) {
      throw new ValidationError('輸入許可日の形式が不正です');
    }
    return this.uow.run(async (repos) => {
      ensureFound(await repos.importApplications.findById(id), '輸入申請', id);
      await repos.importApplications.updateStatus(
        id,
        {
          ...input,
          status,
          confirmedDate:
            input.confirmedDate ??
            (status === IMPORT_APPLICATION_STATUS.APPROVED ? todayInTokyo() : undefined),
        },
        actor.id,
      );
      return ensureFound(await repos.importApplications.findById(id), '輸入申請', id);
    }, actor);
  }
}
