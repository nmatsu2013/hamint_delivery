import type { ProductEntity } from '../domain/entities/product.entity';
import type { IProductRepository } from '../domain/repositories/product.repository.interface';
import { toNullableNumber, type Queryable } from './database';

interface ProductRow {
  id: string;
  product_code: string;
  product_name: string;
  product_name_kr: string | null;
  product_name_en: string | null;
  model_no: string;
  supplier_id: string;
  supplier_name?: string;
  category: string | null;
  material: string | null;
  thickness: string | null;
  length_mm: string | null;
  spec_note: string | null;
  usage: string | null;
  priority_class: string | null;
  pack_qty: number;
  unit: string;
  is_lot_managed: boolean;
  is_expiry_managed: boolean;
  hs_code: string | null;
  regulatory_info: string | null;
  storage_condition: string | null;
  is_active: boolean;
}

function mapProduct(row: ProductRow): ProductEntity {
  return {
    id: row.id,
    productCode: row.product_code,
    productName: row.product_name,
    productNameKr: row.product_name_kr,
    productNameEn: row.product_name_en,
    modelNo: row.model_no,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    category: row.category,
    material: row.material,
    thickness: row.thickness,
    lengthMm: toNullableNumber(row.length_mm),
    specNote: row.spec_note,
    usage: row.usage,
    priorityClass: row.priority_class,
    packQty: row.pack_qty,
    unit: row.unit,
    isLotManaged: row.is_lot_managed,
    isExpiryManaged: row.is_expiry_managed,
    hsCode: row.hs_code,
    regulatoryInfo: row.regulatory_info,
    storageCondition: row.storage_condition,
    isActive: row.is_active,
  };
}

const PRODUCT_SELECT = `
  select p.*, s.supplier_name
  from products p
  join suppliers s on s.id = p.supplier_id
`;

export class PgProductRepository implements IProductRepository {
  constructor(private readonly db: Queryable) {}

  async listActive(): Promise<ProductEntity[]> {
    const result = await this.db.query<ProductRow>(
      `${PRODUCT_SELECT} where p.is_active order by p.product_code asc`,
    );
    return result.rows.map(mapProduct);
  }

  async findById(id: string): Promise<ProductEntity | null> {
    const result = await this.db.query<ProductRow>(
      `${PRODUCT_SELECT} where p.id = $1 and p.is_active`,
      [id],
    );
    const row = result.rows[0];
    return row ? mapProduct(row) : null;
  }

  async findByCode(productCode: string): Promise<ProductEntity | null> {
    const result = await this.db.query<ProductRow>(
      `${PRODUCT_SELECT} where p.product_code = $1 and p.is_active`,
      [productCode],
    );
    const row = result.rows[0];
    return row ? mapProduct(row) : null;
  }
}
