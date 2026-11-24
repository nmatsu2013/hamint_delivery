import type { ImportApplicationStatus } from './status';

export interface ImportDocumentEntity {
  id: string;
  applicationId: string;
  documentName: string;
  filePath: string | null;
  submittedDate: string | null;
  isActive: boolean;
}

export interface ImportApplicationEntity {
  id: string;
  applicationNo: string;
  purchaseOrderId: string;
  purchaseOrderNo?: string;
  applicationType: string;
  appliedDate: string | null;
  status: ImportApplicationStatus;
  confirmedDate: string | null;
  assigneeId: string | null;
  note: string | null;
  customsBroker: string | null;
  importPermitDate: string | null;
  declarationNo: string | null;
  taxableValue: number | null;
  dutyTotal: number | null;
  importConsumptionTax: number | null;
  customsFee: number | null;
  otherCosts: number | null;
  currency: string;
  isActive: boolean;
  documents: ImportDocumentEntity[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateImportApplicationInput {
  purchaseOrderId: string;
  applicationType?: string;
  appliedDate?: string;
  assigneeId?: string;
  note?: string;
  customsBroker?: string;
  documents?: Array<{ documentName: string; filePath?: string; submittedDate?: string }>;
}

export interface UpdateImportApplicationStatusInput {
  status: string;
  confirmedDate?: string;
  note?: string;
  customsBroker?: string;
  importPermitDate?: string;
  declarationNo?: string;
  taxableValue?: number;
  dutyTotal?: number;
  importConsumptionTax?: number;
  customsFee?: number;
  otherCosts?: number;
}
