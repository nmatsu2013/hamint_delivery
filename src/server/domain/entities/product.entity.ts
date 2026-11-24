export interface ProductEntity {
  id: string;
  productCode: string;
  productName: string;
  productNameKr: string | null;
  productNameEn: string | null;
  modelNo: string;
  supplierId: string;
  supplierName?: string;
  category: string | null;
  material: string | null;
  thickness: string | null;
  lengthMm: number | null;
  specNote: string | null;
  usage: string | null;
  priorityClass: string | null;
  packQty: number;
  unit: string;
  isLotManaged: boolean;
  isExpiryManaged: boolean;
  hsCode: string | null;
  regulatoryInfo: string | null;
  storageCondition: string | null;
  isActive: boolean;
}
